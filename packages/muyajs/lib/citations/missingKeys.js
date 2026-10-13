// EndNote's BibTeX export can omit the key entirely. Skip those records only
// in memory, preserving source positions for diagnostics from the real parser.
const skipTrivia = (text, start) => {
  let position = start
  while (position < text.length) {
    if (/\s/.test(text[position])) position++
    else if (text[position] === '%') {
      const end = text.indexOf('\n', position)
      position = end < 0 ? text.length : end + 1
    } else break
  }
  return position
}

const entryEnd = (text, open) => {
  const braced = text[open] === '{'
  const base = braced ? 1 : 0
  let depth = base
  let quoted = false
  for (let i = open + 1; i < text.length; i++) {
    const char = text[i]
    if (char === '\\') { i++; continue }
    if (char === '"' && depth === base) { quoted = !quoted; continue }
    if (char === '%' && !quoted && depth === base) {
      const end = text.indexOf('\n', i)
      if (end < 0) return -1
      i = end
      continue
    }
    if (char === '{') depth++
    else if (char === '}') {
      depth--
      if (braced && depth === 0 && !quoted) return i + 1
    } else if (!braced && char === ')' && depth === 0 && !quoted) return i + 1
  }
  return -1 // Let the real BibTeX parser diagnose unclosed entries.
}

export const omitMissingKeyEntries = (text) => {
  const ranges = []
  for (let position = 0; position < text.length;) {
    if (text[position] === '%') { position = skipTrivia(text, position); continue }
    if (text[position] !== '@') { position++; continue }
    const header = /^@([a-zA-Z_][a-zA-Z0-9_:+-]*)\s*([({])/.exec(text.slice(position))
    if (!header && /^@comment\b/i.test(text.slice(position))) {
      const end = text.indexOf('\n', position)
      position = end < 0 ? text.length : end + 1
      continue
    }
    if (!header) { position++; continue }
    const open = position + header[0].length - 1
    const end = entryEnd(text, open)
    if (end < 0) break
    if (!/^(?:comment|string|preamble)$/i.test(header[1])) {
      const field = skipTrivia(text, open + 1)
      const emptyComma = text[field] === ','
      if (emptyComma || field === end - 1 || /^[a-zA-Z_][a-zA-Z0-9_:+-]*\s*=/.test(text.slice(field))) {
        ranges.push({ start: position, end })
      }
    }
    position = end
  }
  let normalized = text
  for (const range of [...ranges].reverse()) {
    normalized = normalized.slice(0, range.start) + text.slice(range.start, range.end).replace(/[^\r\n]/g, ' ') + normalized.slice(range.end)
  }
  return { text: normalized, skipped: ranges.length }
}
