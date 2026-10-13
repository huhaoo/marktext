import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { launchWithMarkdown, enterSourceMode, exitSourceMode, clickMenuById, getMarkdownContent, expectNoRendererErrors, sendIpcToRenderer } from './helpers'

const bibliography = `@article{Vaswani2017, author={Vaswani, Ashish}, title={Attention Is All You Need}, year={2017}, journal={Journal}}
@article{zhang2024, author={张三}, title={中文标题测试}, year={2024}, journal={示例期刊}}`
// CodeMirror's public API is exposed on its wrapper by the editor itself.
interface CM {
  getValue(): string;
  setValue(value: string): void;
  lastLine(): number;
  getLine(line: number): string;
  setCursor(pos: { line: number; ch: number }): void;
  replaceRange(text: string, pos: { line: number; ch: number }): void;
  focus(): void
}

test.describe.serial('Bibliographic citations', () => {
  let app: ElectronApplication
  let page: Page
  let dir: string
  let markdown: string
  test.beforeAll(async() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'marktext-citation-test-'))
    const bibPath = path.join(dir, 'references.bib')
    fs.writeFileSync(bibPath, bibliography)
    markdown = `---\nbibliography: ${JSON.stringify(bibPath.replace(/\\/g, '/'))}\ncsl: ieee\n---\n\nText [@Vaswani2017].\n\nSecond paragraph.`
    const launched = await launchWithMarkdown(markdown, { suppressErrorDialog: true })
    app = launched.app
    page = launched.page
  })
  test.afterAll(async() => {
    if (app) await app.close()
    if (dir) fs.rmSync(dir, { recursive: true, force: true })
  })
  test('renders the saved bibliography and switches to source only while editing the citation', async() => {
    await expect(page.locator('.mt-reference-footer')).toContainText('Attention Is All You Need')
    const citation = page.locator('.ag-citation').first()
    await expect(citation.locator('.ag-citation-render')).toHaveText('[1]')
    await page.locator('.editor-component span.ag-paragraph').filter({ hasText: 'Second paragraph' }).click()
    await expect(citation).not.toHaveClass(/ag-citation-editing/)
    await citation.locator('.ag-citation-render').click()
    await expect(citation).toHaveClass(/ag-citation-editing/)
    await expect(citation.locator('.ag-citation-text')).toHaveText('[@Vaswani2017]')
    await page.locator('.editor-component span.ag-paragraph').filter({ hasText: 'Second paragraph' }).click()
    await expect(citation).not.toHaveClass(/ag-citation-editing/)
    await expectNoRendererErrors(app)
  })
  test('completes by English title in source mode and keeps the footer unchanged until save', async() => {
    await enterSourceMode(page, app)
    await page.evaluate(() => {
      const cm = (document.querySelector('.source-code .CodeMirror') as Element & { CodeMirror: CM }).CodeMirror
      cm.setCursor({ line: cm.lastLine(), ch: cm.getLine(cm.lastLine()).length })
      cm.focus()
    })
    await page.keyboard.type(' [@Attention Is All')
    await expect(page.locator('.mt-citation-completion:not([hidden])')).toBeVisible()
    await expect(page.locator('.mt-citation-completion:not([hidden]) .mt-citation-option').first()).toContainText('Vaswani2017')
    await page.keyboard.press('Enter')
    const source = await getMarkdownContent(page, app)
    expect(source).toContain('Second paragraph. [@Vaswani2017]')
    await page.keyboard.type(' [@中文标题')
    await expect(page.locator('.mt-citation-completion:not([hidden]) .mt-citation-option').first()).toContainText('zhang2024')
    await page.keyboard.press('Tab')
    await exitSourceMode(page, app)
    await expect(page.locator('.mt-reference-pending')).toBeVisible()
    await expect(page.locator('.mt-reference-footer')).not.toContainText('中文标题测试')
    await expect(page.locator('.ag-citation-render').last()).toContainText('[2]')
    await clickMenuById(app, 'saveMenuItem')
    await expect(page.locator('.mt-reference-footer')).toContainText('中文标题测试')
    await expect(page.locator('.mt-reference-pending')).toHaveCount(0)
    await expectNoRendererErrors(app)
  })
  test('opens citation settings and preserves YAML when applying', async() => {
    await clickMenuById(app, 'citationsSettingsMenuItem')
    await expect(page.locator('.el-dialog')).toBeVisible()
    await expect(page.locator('.el-dialog textarea')).toHaveValue(/references\.bib/)
    await page.locator('.el-dialog input').last().fill('My References')
    await page.locator('.el-dialog .el-dialog__footer button').last().click()
    expect(await getMarkdownContent(page, app)).toContain('reference-section-title: My References')
    await clickMenuById(app, 'saveMenuItem')
    await expect(page.locator('.mt-reference-footer summary')).toHaveText('My References')
    await expectNoRendererErrors(app)
  })
  test('completes by citation key in the regular editor and undoes the insertion as one edit', async() => {
    await page.evaluate(() => {
      const root = document.querySelector('.editor-component') as HTMLElement
      const paragraph = Array.from(root.querySelectorAll('span.ag-paragraph')).find(span => span.textContent?.includes('Second paragraph'))!
      root.focus()
      const range = document.createRange()
      range.selectNodeContents(paragraph)
      range.collapse(false)
      const selection = window.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)
    })
    await page.keyboard.type(' [@vasw', { delay: 30 })
    await expect(page.locator('.mt-citation-completion:not([hidden])')).toBeVisible()
    await expect(page.locator('.mt-citation-completion:not([hidden]) .mt-citation-option').first()).toContainText('Attention Is All You Need')
    await page.keyboard.press('Enter')
    await expect(page.locator('.ag-citation-render').last()).toContainText('[1]')
    await sendIpcToRenderer(app, 'mt::editor-edit-action', 'undo')
    expect(await getMarkdownContent(page, app)).toContain('[@vasw')
    await expectNoRendererErrors(app)
  })
  test('exports current citations to HTML and PDF without refreshing the saved footer', async() => {
    await enterSourceMode(page, app)
    await page.evaluate((value) => {
      const cm = (document.querySelector('.source-code .CodeMirror') as Element & { CodeMirror: CM }).CodeMirror
      cm.setValue(value)
    }, markdown.replace('[@Vaswani2017]', '[@zhang2024]'))
    const before = await page.locator('.mt-reference-footer .mt-bibliography').innerHTML()
    for (const type of ['styledHtml', 'pdf']) {
      const filePath = path.join(dir, type === 'pdf' ? 'citation.pdf' : 'citation.html')
      await app.evaluate(({ dialog }, output) => {
        dialog.showSaveDialog = async() => ({ canceled: false, filePath: output })
      }, filePath)
      await sendIpcToRenderer(app, 'mt::show-export-dialog', type)
      await page.locator('.print-settings-dialog .button-primary').click()
      await expect.poll(() => fs.existsSync(filePath), { timeout: 20000 }).toBe(true)
      const content = fs.readFileSync(filePath)
      if (type === 'styledHtml') {
        const html = content.toString('utf8')
        expect(html).toContain('中文标题测试')
        expect(html).not.toContain('Attention Is All You Need')
        expect(html).not.toContain('[@zhang2024]')
        expect(html).not.toContain('<pre class="front-matter">')
        expect(html).not.toContain('bibliography:')
      } else {
        expect(content.subarray(0, 4).toString()).toBe('%PDF')
        expect(content.length).toBeGreaterThan(1000)
      }
    }
    expect(await page.locator('.mt-reference-footer .mt-bibliography').innerHTML()).toBe(before)
    await expectNoRendererErrors(app)
  })
})

test('skips missing EndNote keys while keeping other entries usable and the library unchanged', async() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'marktext-endnote-test-'))
  const bibPath = path.join(dir, 'endnote.txt')
  const text = '@misc{\n author={Doe, Jane}, title={Skipped EndNote Export}, year={2026}\n}\n' + bibliography
  fs.writeFileSync(bibPath, text)
  let app: ElectronApplication | undefined
  try {
    const launched = await launchWithMarkdown(`---\nbibliography: ${JSON.stringify(bibPath.replace(/\\/g, '/'))}\ncsl: ieee\n---\n\nText.`, { suppressErrorDialog: true })
    app = launched.app
    const page = launched.page
    await expect(page.locator('.mt-citation-notice')).toContainText(/1/)
    await expect(page.locator('.mt-citation-notice')).toContainText(/Skipped|跳过/)
    await expect(page.locator('.mt-citation-error')).toHaveCount(0)
    await enterSourceMode(page, app)
    await page.evaluate(() => {
      const cm = (document.querySelector('.source-code .CodeMirror') as Element & { CodeMirror: CM }).CodeMirror
      cm.setCursor({ line: cm.lastLine(), ch: cm.getLine(cm.lastLine()).length })
      cm.focus()
    })
    await page.keyboard.type(' [@Skipped EndNote')
    await expect(page.locator('.mt-citation-completion:not([hidden])')).toHaveCount(0)
    // Replace the unfinished search via the editor API, then search a valid entry.
    await page.evaluate(() => {
      const cm = (document.querySelector('.source-code .CodeMirror') as Element & { CodeMirror: CM }).CodeMirror
      cm.setValue(cm.getValue().replace(' [@Skipped EndNote', ''))
      cm.setCursor({ line: cm.lastLine(), ch: cm.getLine(cm.lastLine()).length })
      cm.focus()
    })
    await page.keyboard.type(' [@Attention Is All')
    const option = page.locator('.mt-citation-completion:not([hidden]) .mt-citation-option').first()
    await expect(option).toContainText('Vaswani2017')
    await page.keyboard.press('Enter')
    expect(await getMarkdownContent(page, app)).toContain('[@Vaswani2017]')
    await exitSourceMode(page, app)
    await expect(page.locator('.ag-citation-render')).toHaveText('[1]')
    await expect(page.locator('.mt-reference-footer')).not.toContainText('Attention Is All You Need')
    await clickMenuById(app, 'saveMenuItem')
    await expect(page.locator('.mt-reference-footer')).toContainText('Attention Is All You Need')
    await expect(page.locator('.mt-reference-footer')).not.toContainText('Skipped EndNote Export')
    expect(fs.readFileSync(bibPath, 'utf8')).toBe(text)
    await expectNoRendererErrors(app)
  } finally {
    if (app) await app.close()
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
