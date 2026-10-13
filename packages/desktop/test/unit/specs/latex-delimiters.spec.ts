import { describe, it, expect } from 'vitest'
import marked, { Lexer } from 'muya/lib/parser/marked'
import { tokenizer, generator } from 'muya/lib/parser'
import ContentState from 'muya/lib/contentState'
import EventCenter from 'muya/lib/eventHandler/event'
import ExportMarkdown from 'muya/lib/utils/exportMarkdown'
import { MUYA_DEFAULT_OPTION } from 'muya/lib/config'
import { collectCitations } from 'muya/lib/citations/collect'

const options = { math: true, mathRenderer: (text: string, display: boolean) => `<span class="${display ? 'block' : 'inline'}">${text}</span>` }
const roundtrip = (markdown: string): string => {
  const muya = { options: { ...MUYA_DEFAULT_OPTION, math: true }, eventCenter: new EventCenter() }
  const state = new ContentState(muya, muya.options)
  state.importMarkdown(markdown)
  return new ExportMarkdown(state.getBlocks()).generate()
}

describe('LaTeX mathematical delimiters', () => {
  it('renders inline parentheses and keeps source ranges and delimiters', () => {
    const text = String.raw`Before \(F_A = F_B\) after.`
    const tokens = tokenizer(text)
    const token = tokens.find((token: { type: string }) => token.type === 'inline_math')
    expect(token).toMatchObject({ marker: '\\(', closingMarker: '\\)', content: 'F_A = F_B', range: { start: 7, end: 20 } })
    expect(generator(tokens)).toBe(text)
    expect(marked(text, options)).toContain('<span class="inline">F_A = F_B</span>')
    expect(roundtrip(text + '\n')).toBe(text + '\n')
  })
  it('renders multiline brackets as display math and preserves the bracket style', () => {
    const text = String.raw`\[
\sum_{i=1}^n x_i
\]` + '\n'
    expect(new Lexer().lex(text)[0]).toMatchObject({ type: 'multiplemath', mathStyle: 'latex', text: String.raw`\sum_{i=1}^n x_i` })
    expect(marked(text, options)).toContain('<span class="block">')
    expect(roundtrip(text)).toBe(text)
  })
  it('supports single-line display brackets and display blocks after prose', () => {
    const text = String.raw`\[x^2+y^2=z^2\]` + '\n'
    expect(new Lexer().lex(text)[0]).toMatchObject({ type: 'multiplemath', mathStyle: 'latex-single' })
    expect(roundtrip(text)).toBe(text)
    const tokens = new Lexer().lex('Before\n' + text)
    expect(tokens.map((token: { type: string }) => token.type)).toEqual(['paragraph', 'multiplemath'])
  })
  it('does not interpret code, escaped openers or unterminated delimiters as math', () => {
    const text = String.raw`Code: \(x\) without closer \(y`
    expect(marked('`' + String.raw`\(x\)` + '`', options)).not.toContain('class="inline"')
    expect(marked(String.raw`\\(x\)`, options)).not.toContain('class="inline"')
    expect(marked('```\n' + String.raw`\[x\]` + '\n```', options)).not.toContain('class="block"')
    expect(marked(String.raw`\(unfinished`, options)).not.toContain('class="inline"')
    expect(new Lexer().lex(String.raw`\[
unfinished`)[0].type).toBe('paragraph')
    expect(tokenizer(text).filter((token: { type: string }) => token.type === 'inline_math')).toHaveLength(1)
  })
  it('allows escaped closing delimiters inside formulas and respects math disabled', () => {
    const text = String.raw`\(a\\)b\)`
    expect(tokenizer(text)[0]).toMatchObject({ type: 'inline_math', content: String.raw`a\\)b` })
    expect(marked(text, options)).toContain(String.raw`a\\)b`)
    expect(marked(String.raw`\(x\)`, { ...options, math: false })).not.toContain('class="inline"')
    expect(tokenizer(String.raw`\(x\)`, { options: { math: false } }).some((token: { type: string }) => token.type === 'inline_math')).toBe(false)
  })
  it('leaves dollar math unchanged and does not collect citations from math', () => {
    expect(marked('$x$\n\n$$\ny\n$$', options)).toContain('<span class="inline">x</span>')
    expect(roundtrip('$x$\n\n$$\ny\n$$\n')).toBe('$x$\n\n$$\ny\n$$\n')
    expect(collectCitations(String.raw`\([@inside]\) and [@outside]`).map(citation => citation.items[0].id)).toEqual(['outside'])
  })
})
