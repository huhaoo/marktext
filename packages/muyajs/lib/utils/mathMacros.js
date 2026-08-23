const MACRO_NAME = /^\\(?:[A-Za-z@]+|[^A-Za-z\s])$/

export const parseMathMacros = (value) => {
  if (typeof value !== 'string') return {}

  const input = value.trim()
  if (!input) return {}

  if (input.startsWith('{')) {
    try {
      const parsed = JSON.parse(input)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return Object.fromEntries(
          Object.entries(parsed).filter(([name, replacement]) => (
            MACRO_NAME.test(name) && typeof replacement === 'string' && replacement.length > 0
          ))
        )
      }
    } catch {
      // Fall through to the line-oriented format.
    }
  }

  const macros = {}
  for (const rawLine of value.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('%') || line.startsWith('//')) continue

    const separator = line.search(/[:=]/)
    if (separator < 0) continue

    const name = line.slice(0, separator).trim()
    const replacement = line.slice(separator + 1).trim()
    if (MACRO_NAME.test(name) && replacement) macros[name] = replacement
  }

  return macros
}
