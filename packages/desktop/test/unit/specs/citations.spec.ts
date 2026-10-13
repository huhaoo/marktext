import { describe, it, expect, beforeEach, vi } from 'vitest'
import { performance } from 'node:perf_hooks'
import path from 'pathe'
import { parseBibliography, collectCitations, formatCitations } from 'muya/lib/citations/engine'
import { parseCitation, referenceId } from 'muya/lib/citations/syntax'
import { citationCompletionContext, citationReplacement, searchCitations } from 'muya/lib/citations/completion'
import { tokenizer, generator } from 'muya/lib/parser'
import { readCitationConfig, writeCitationConfig, activateCitations, updateCitations, citationState, citationFormatCount, prepareCitationExport } from '@/services/citations'
import { CitationCompletion } from '@/services/citationCompletion'

vi.mock('@/i18n', () => ({ t: (key: string) => key }))
vi.mock('@/services/citationProcessor', async() => {
  const engine = await import('muya/lib/citations/engine')
  return { parseBibliography: async(...args: Parameters<typeof engine.parseBibliography>) => engine.parseBibliography(...args), formatCitations: async(...args: Parameters<typeof engine.formatCitations>) => engine.formatCitations(...args) }
})
const bib = `@article{Vaswani2017,
  author = {Vaswani, Ashish}, title = {Attention Is All You Need},
  year = {2017}, journal = {Advances in Neural Information Processing Systems}
}
@article{zhang2024,
  author = {张三}, title = {中文标题测试}, year = {2024}, journal = {示例期刊}
}`
const entries = () => parseBibliography([{ text: bib, path: 'references.bib' }])
const doc = (text: string, id = 'citation-test') => ({ id, pathname: 'C:/papers/paper.md', markdown: `---\nbibliography: refs.bib\ncsl: ieee\n---\n\n${text}` })

describe('citation parsing and document formatting', () => {
  it('preserves BibTeX keys, title and Unicode', () => {
    expect(entries().map(entry => entry.id)).toEqual(['Vaswani2017', 'zhang2024'])
    expect(entries()[1].title).toBe('中文标题测试')
  })
  it('rejects duplicate keys across libraries', () => {
    expect(() => parseBibliography([{ text: bib, path: 'one.bib' }, { text: bib, path: 'two.bib' }])).toThrow(/Vaswani2017/)
  })
  it('parses multiple items and pages, preserving the source', () => {
    expect(parseCitation('[@Vaswani2017; @zhang2024, pp. 3–5] rest')?.items).toEqual([{ id: 'Vaswani2017' }, { id: 'zhang2024', label: 'page', locator: '3–5' }])
    const text = 'Text **[@Vaswani2017]** and [@zhang2024].'
    const tokens = tokenizer(text, { options: { citations: true } })
    expect(generator(tokens)).toBe(text)
    expect(tokens.some((token: { type: string }) => token.type === 'citation')).toBe(true)
  })
  it('does not collect code, math, links, HTML attributes or escaped syntax', () => {
    const markdown = ['`[@no]` $[@no]$ \\[@no] [@no](https://example.com)', '<span title="[@no]">text</span>', '', '```', '[@no]', '```', '', '[@Vaswani2017] [@zhang2024]'].join('\n')
    expect(collectCitations(markdown).map(citation => citation.items[0].id)).toEqual(['Vaswani2017', 'zhang2024'])
  })
  it('assigns numbers by first occurrence and excludes uncited entries', () => {
    const result = formatCitations(entries(), collectCitations('[@zhang2024] [@Vaswani2017] [@zhang2024]'))
    expect(result.inline.get('[@zhang2024]')?.html).toContain('[1]')
    expect(result.inline.get('[@Vaswani2017]')?.html).toContain('[2]')
    expect(result.bibliography.indexOf('中文标题测试')).toBeLessThan(result.bibliography.indexOf('Attention'))
    expect(formatCitations(entries(), collectCitations('[@Vaswani2017]')).bibliography).not.toContain('中文标题测试')
  })
  it('supports APA and reports missing keys without inventing references', () => {
    const result = formatCitations(entries(), collectCitations('[@Vaswani2017] [@missing]'), 'apa')
    expect(result.inline.get('[@Vaswani2017]')?.html).toContain('2017')
    expect(result.missing).toEqual(['missing'])
    expect(result.inline.has('[@missing]')).toBe(false)
  })
  it('uses distinct URL-safe anchors for punctuation and Unicode citation keys', () => {
    const keys = ['Smith:2024', 'Smith%3A2024', '张三2024']
    const ids = keys.map(referenceId)
    expect(new Set(ids).size).toBe(3)
    for (const id of ids) expect(decodeURIComponent(id)).toBe(id)
    const data = keys.map((id, index) => ({ ...entries()[0], id, title: `Paper ${index}` }))
    const result = formatCitations(data, collectCitations(`[@${keys[0]}]`))
    expect(result.inline.get(`[@${keys[0]}]`)?.html).toContain(`href="#${ids[0]}"`)
    expect(result.bibliography).toContain(`id="${ids[0]}"`)
  })
  it('revisits earlier APA citations for same-author same-year disambiguation', () => {
    const data = [1, 2].map(number => ({ id: `key${number}`, type: 'article-journal', title: `Paper ${number}`, author: [{ family: 'Smith', given: 'John' }], issued: { 'date-parts': [[2024]] } }))
    const result = formatCitations(data, collectCitations('[@key1] [@key2]'), 'apa')
    expect(result.inline.get('[@key1]')?.html).toContain('2024a')
    expect(result.inline.get('[@key2]')?.html).toContain('2024b')
  })
})

describe('citation key and title completion', () => {
  it('finds the same entry by key or English title, and supports Chinese titles', () => {
    expect(searchCitations(entries(), 'vasw')[0].id).toBe('Vaswani2017')
    expect(searchCitations(entries(), 'attention need')[0].id).toBe('Vaswani2017')
    expect(searchCitations(entries(), '中文标题')[0].id).toBe('zhang2024')
  })
  it('replaces only the current item and preserves pages and closing brackets', () => {
    const text = 'See [@zhang2024; @Attention Is All, p. 3] end'
    const context = citationCompletionContext(text, text.indexOf(', p.'))!
    expect(context.query).toBe('Attention Is All')
    const replacement = citationReplacement(context, 'Vaswani2017')
    expect(text.slice(0, context.start) + replacement + text.slice(context.end)).toBe('See [@zhang2024; @Vaswani2017, p. 3] end')
  })
  it('opens for an empty query and completes unfinished brackets', () => {
    expect(citationCompletionContext('Text [@', 7)?.query).toBe('')
    const context = citationCompletionContext('[@vasw', 6)!
    expect(citationReplacement(context, 'Vaswani2017')).toBe('Vaswani2017]')
  })
  it('does not trigger in code, math, escaped citations or link destinations', () => {
    for (const text of ['`[@foo]`', '$[@foo]$', '\\[@foo]', '[link](https://example.com/[@foo])', '<a title="[@foo]">']) {
      const context = citationCompletionContext(text, text.indexOf('foo') + 3)
      expect(context, text).toBeNull()
    }
  })
  it('preserves following prose when completing an unfinished bracket in the middle of a line', () => {
    const text = 'Start [@vasw and more prose'
    const context = citationCompletionContext(text, 12)
    expect(context).not.toBeNull()
    if (!context) return
    expect(text.slice(0, context.start) + citationReplacement(context, 'Vaswani2017') + text.slice(context.end)).toBe('Start [@Vaswani2017] and more prose')
  })
})

describe('configuration, saved bibliography snapshots and caching', () => {
  beforeEach(() => {
    Object.assign(window, { path, fileUtils: { stat: vi.fn(async() => ({ isFile: true, mtimeMs: 1, size: bib.length })), readFile: vi.fn(async() => bib) } })
  })
  it('reads multiple paths and preserves unrelated YAML fields and comments', () => {
    const markdown = '---\n# keep this\ntitle: Draft\nbibliography: [a.bib, b.bib]\n---\nText'
    expect(readCitationConfig(markdown)?.bibliography).toEqual(['a.bib', 'b.bib'])
    const updated = writeCitationConfig(markdown, { bibliography: ['my.bib'], csl: 'apa', title: 'References' })
    expect(updated).toContain('# keep this')
    expect(updated).toContain('title: Draft')
    expect(updated).toContain('---\nText')
    expect(readCitationConfig('---\ntitle: ordinary\n---\nText')).toBeNull()
  })
  it('updates inline references but freezes the bibliography until a successful save', async() => {
    activateCitations('save-test')
    await updateCitations(doc('[@Vaswani2017]', 'save-test'))
    const saved = citationState.bibliography
    await updateCitations(doc('[@Vaswani2017] [@zhang2024]', 'save-test'))
    expect(citationState.inline.get('[@zhang2024]')?.html).toContain('[2]')
    expect(citationState.bibliography).toBe(saved)
    expect(citationState.pending).toBe(true)
    await updateCitations(doc('[@Vaswani2017] [@zhang2024]', 'save-test'), { saved: true })
    expect(citationState.bibliography).toContain('中文标题测试')
    expect(citationState.pending).toBe(false)
  })
  it('ordinary prose edits do not rerun CSL or reload files', async() => {
    activateCitations('cache-test')
    await updateCitations(doc('[@Vaswani2017] first', 'cache-test'))
    const count = citationFormatCount()
    const revision = citationState.revision
    await updateCitations(doc('[@Vaswani2017] more ordinary prose', 'cache-test'))
    expect(citationFormatCount()).toBe(count)
    expect(citationState.revision).toBe(revision)
    expect(window.fileUtils.readFile).not.toHaveBeenCalled()
  })
  it('does not generate the footer of a new unsaved document until save succeeds', async() => {
    activateCitations('new-doc-test')
    const newDoc = { ...doc('[@Vaswani2017]', 'new-doc-test'), isSaved: false }
    await updateCitations(newDoc)
    expect(citationState.bibliography).toBe('')
    expect(citationState.pending).toBe(true)
    await updateCitations(newDoc, { saved: true })
    expect(citationState.bibliography).toContain('Attention Is All You Need')
    expect(citationState.pending).toBe(false)
  })
  it('export uses current references without refreshing the saved footer, and rejects missing keys', async() => {
    activateCitations('export-test')
    await updateCitations(doc('[@Vaswani2017]', 'export-test'))
    const saved = citationState.bibliography
    const result = await prepareCitationExport(doc('[@zhang2024]', 'export-test'), {})
    expect(result?.bibliography).toContain('中文标题测试')
    expect(citationState.bibliography).toBe(saved)
    await expect(prepareCitationExport(doc('[@missing]', 'export-test'), {})).rejects.toThrow(/missing/)
  })
  it('does not restore an older bibliography when a newer save removes citation configuration', async() => {
    const processor = await import('@/services/citationProcessor')
    let release: ((value: ReturnType<typeof formatCitations>) => void) | undefined
    const spy = vi.spyOn(processor, 'formatCitations').mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
    activateCitations('save-race-test')
    const oldSave = updateCitations(doc('[@Vaswani2017]', 'save-race-test'), { saved: true })
    await vi.waitFor(() => expect(release).toBeDefined())
    const current = { id: 'save-race-test', pathname: 'C:/papers/paper.md', markdown: 'No citation configuration.' }
    await updateCitations(current, { saved: true })
    release?.(formatCitations(entries(), collectCitations('[@Vaswani2017]')))
    await oldSave
    await updateCitations(current)
    expect(citationState.bibliography).toBe('')
    expect(citationState.bibliographyTitle).toBe('')
    spy.mockRestore()
  })
  it('measures a 1000-entry bibliography and 200 citation clusters', () => {
    const text = Array.from({ length: 1000 }, (_, i) => `@article{key${i}, author={Smith, John}, title={Paper ${i}}, year={2024}, journal={Journal}}`).join('\n')
    const start = performance.now()
    const data = parseBibliography([{ path: 'large.bib', text }])
    const parsed = performance.now()
    const result = formatCitations(data, collectCitations(Array.from({ length: 200 }, (_, i) => `[@key${i}]`).join(' ')))
    console.info(`Citation benchmark: parse ${Math.round(parsed - start)} ms; format 200 clusters ${Math.round(performance.now() - parsed)} ms`)
    expect(result.inline.size).toBe(200)
  })
})

describe('completion keyboard interaction', () => {
  it('confirms the latest query when Enter arrives before the popup debounce', () => {
    Object.assign(citationState, { enabled: true, entries: entries() })
    const scope = document.createElement('div')
    document.body.appendChild(scope)
    let context = { query: 'vasw', start: 2, end: 6, addClosing: true, line: 0, rect: { left: 10, bottom: 20 } }
    const replace = vi.fn()
    const popup = new CitationCompletion({ scope, context: () => context, replace })
    popup.update()
    context = { ...context, query: '中文标题', end: 6 }
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    scope.dispatchEvent(event)
    expect(replace).toHaveBeenCalledWith(context, 'zhang2024]')
    expect(event.defaultPrevented).toBe(true)
    popup.destroy()
    scope.remove()
  })
  it('does not capture Enter during IME composition or when no entries match', () => {
    Object.assign(citationState, { enabled: true, entries: entries() })
    const scope = document.createElement('div')
    document.body.appendChild(scope)
    const popup = new CitationCompletion({ scope, context: () => ({ query: 'unknown title', start: 2, end: 15, addClosing: true, rect: { left: 10, bottom: 20 } }), replace: vi.fn() })
    popup.update()
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    scope.dispatchEvent(enter)
    expect(enter.defaultPrevented).toBe(false)
    scope.dispatchEvent(new Event('compositionstart'))
    const composing = new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, cancelable: true })
    scope.dispatchEvent(composing)
    expect(composing.defaultPrevented).toBe(false)
    popup.destroy()
    scope.remove()
  })
})
