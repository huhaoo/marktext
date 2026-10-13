import { test, expect } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { launchWithMarkdown, getMarkdownContent, enterSourceMode, exitSourceMode, sendIpcToRenderer, expectNoRendererErrors } from './helpers'

const fixture = String.raw`Inline \(F_A = F_B\) and $x^2$.

\[
\sum_{i=1}^n x_i
\]

\[x^2+y^2=z^2\]

Normal text.

Code: ` + '`' + String.raw`\(not_math\)` + '`' + '\n\n```text\n' + String.raw`\[not_math\]` + '\n```\n'

test.describe.serial('LaTeX parentheses and brackets', () => {
  let app: ElectronApplication
  let page: Page
  test.beforeAll(async() => {
    const launched = await launchWithMarkdown(fixture, { suppressErrorDialog: true })
    app = launched.app
    page = launched.page
  })
  test.afterAll(async() => { if (app) await app.close() })
  test('renders inline and display math, preserving the delimiters through source mode', async() => {
    await expect(page.locator('.editor-component .katex')).toHaveCount(4)
    await expect(page.locator('.ag-math-error')).toHaveCount(0)
    const markdown = await getMarkdownContent(page, app)
    expect(markdown).toContain(String.raw`\(F_A = F_B\)`)
    expect(markdown).toContain(String.raw`\[
\sum_{i=1}^n x_i
\]`)
    expect(markdown).toContain(String.raw`\[x^2+y^2=z^2\]`)
    await expectNoRendererErrors(app)
  })
  test('highlights math without treating underscores as emphasis or code examples as formulas', async() => {
    await enterSourceMode(page, app)
    await expect(page.locator('.source-code .cm-math-inline')).not.toHaveCount(0)
    await expect(page.locator('.source-code .cm-math-block')).not.toHaveCount(0)
    const erroneous = await page.locator('.source-code .cm-em').allTextContents()
    expect(erroneous.join('')).not.toContain('F_A')
    const mathText = await page.locator('.source-code .cm-math').allTextContents()
    expect(mathText.join('')).not.toContain('not_math')
    await exitSourceMode(page, app)
    await expectNoRendererErrors(app)
  })
  test('exports rendered math instead of raw LaTeX delimiters', async() => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'marktext-latex-export-'))
    try {
      const output = path.join(dir, 'math.html')
      await app.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async() => ({ canceled: false, filePath }) }, output)
      await sendIpcToRenderer(app, 'mt::show-export-dialog', 'styledHtml')
      await page.locator('.print-settings-dialog .button-primary').click()
      await expect.poll(() => fs.existsSync(output), { timeout: 20000 }).toBe(true)
      const html = fs.readFileSync(output, 'utf8')
      expect(html).toContain('katex-display')
      const body = html.slice(html.indexOf('<article class="markdown-body">'))
      expect(body.match(/class="katex"/g)).toHaveLength(4)
      expect(body).not.toContain(String.raw`\(F_A = F_B\)`)
      await expectNoRendererErrors(app)
    } finally { fs.rmSync(dir, { recursive: true, force: true }) }
  })
})
