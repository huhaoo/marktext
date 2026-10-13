const findClose = (source, closer, start) => {
  let position = source.indexOf(closer, start)
  while (position >= 0) {
    let slashes = 0
    for (let i = position - 1; i >= 0 && source[i] === '\\'; i--) slashes++
    if (slashes % 2 === 0) return position
    position = source.indexOf(closer, position + closer.length)
  }
  return -1
}

export const matchLatexInlineMath = (source) => {
  if (!source.startsWith('\\(')) return null
  const end = findClose(source, '\\)', 2)
  if (end < 0 || !source.slice(2, end).trim()) return null
  return { raw: source.slice(0, end + 2), content: source.slice(2, end), marker: '\\(', closingMarker: '\\)' }
}

export const matchLatexDisplayMath = (source) => {
  const open = /^ {0,3}\\\[/.exec(source)
  if (!open) return null
  const firstLineEnd = source.indexOf('\n')
  const firstLine = firstLineEnd < 0 ? source : source.slice(0, firstLineEnd)
  const end = findClose(firstLine, '\\]', open[0].length)
  if (end >= 0 && !firstLine.slice(end + 2).trim()) {
    const suffix = /^\n*/.exec(source.slice(firstLine.length))[0]
    return { raw: firstLine + suffix, content: firstLine.slice(open[0].length, end), mathStyle: 'latex-single' }
  }
  if (firstLineEnd < 0 || firstLine.slice(open[0].length).trim()) return null
  const rest = source.slice(firstLineEnd + 1)
  const close = /^ {0,3}\\\][ \t]*(?:\n+|$)/m.exec(rest)
  if (!close) return null
  const content = rest.slice(0, close.index).replace(/\n$/, '')
  return { raw: source.slice(0, firstLineEnd + 1 + close.index + close[0].length), content, mathStyle: 'latex' }
}
