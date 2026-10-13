import { tokenizer } from '../parser'

const normalize = (text) => String(text || '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase()

export const searchCitations = (entries, query, limit = 30) => {
  const needle = normalize(query)
  const words = needle.split(' ')
  return entries.map((entry, index) => {
    const key = normalize(entry.id)
    const title = normalize(entry.title)
    const other = normalize(`${entry.author?.map(person => person.literal || `${person.family || ''} ${person.given || ''}`).join(' ') || ''} ${entry.issued?.['date-parts']?.[0]?.[0] || ''}`)
    let score = 99
    if (!needle || key === needle) score = 0
    else if (key.startsWith(needle)) score = 1
    else if (title.includes(needle)) score = 2
    else if (words.every(word => title.includes(word))) score = 3
    else if (key.includes(needle) || words.every(word => `${title} ${other}`.includes(word))) score = 4
    return { entry, score, index }
  }).filter(item => item.score < 99).sort((a, b) => a.score - b.score || a.index - b.index).slice(0, limit).map(item => item.entry)
}

export const citationCompletionContext = (text, offset) => {
  const prefix = text.slice(0, offset)
  const open = prefix.lastIndexOf('[')
  if (open < 0 || text[open - 1] === '!' || /\\+$/.exec(text.slice(0, open))?.[0].length % 2 === 1) return null
  const inside = prefix.slice(open + 1)
  if (!inside.startsWith('@') || /[\]\n]/.test(inside)) return null
  const parts = inside.split(';')
  if (parts.slice(0, -1).some(part => !/^\s*@\S+(?:,\s*pp?\.\s+[^;]+)?\s*$/.test(part))) return null
  const current = /^\s*@([^,;]*)$/.exec(parts[parts.length - 1])
  if (!current) return null
  const forbidden = (tokens) => tokens.some(token => {
    if (open >= token.range.start && open < token.range.end && /inline_code|inline_math|html_tag|link|image|reference_definition|multiple_math/.test(token.type)) return true
    return token.children && forbidden(token.children)
  })
  if (forbidden(tokenizer(text, { hasBeginRules: false }))) return null
  const start = offset - current[1].length
  const remainder = text.slice(offset)
  const close = text.indexOf(']', open)
  const addClosing = close < 0 || text.slice(open, close).includes('\n')
  const end = addClosing ? offset : offset + (/^[^\],;\n]*/.exec(remainder)?.[0].length || 0)
  return { query: current[1], start, end, addClosing }
}

export const citationReplacement = (context, key) => `${key}${context.addClosing ? ']' : ''}`
