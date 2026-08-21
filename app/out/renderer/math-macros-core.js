(function () {
  'use strict'

  const STORAGE_KEY = 'marktext.mathMacros'
  const MACRO_NAME = /^\\(?:[A-Za-z@]+|[^A-Za-z\s])$/

  function parseMathMacros(value) {
    if (typeof value !== 'string') {
      return {}
    }

    const input = value.trim()
    if (!input) {
      return {}
    }

    if (input.startsWith('{')) {
      try {
        const parsed = JSON.parse(input)
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return Object.fromEntries(
            Object.entries(parsed).filter(function ([name, replacement]) {
              return MACRO_NAME.test(name) && typeof replacement === 'string' && replacement.length > 0
            })
          )
        }
      } catch (_) {
        // Fall through to the line-oriented format.
      }
    }

    const macros = {}
    value.split(/\r?\n/).forEach(function (rawLine) {
      const line = rawLine.trim()
      if (!line || line.startsWith('%') || line.startsWith('//')) {
        return
      }

      const separator = line.search(/[:=]/)
      if (separator < 0) {
        return
      }

      const name = line.slice(0, separator).trim()
      const replacement = line.slice(separator + 1).trim()
      if (MACRO_NAME.test(name) && replacement) {
        macros[name] = replacement
      }
    })
    return macros
  }

  function getRaw() {
    try {
      return window.localStorage.getItem(STORAGE_KEY) || ''
    } catch (_) {
      return ''
    }
  }

  function get() {
    return parseMathMacros(getRaw())
  }

  function set(value) {
    try {
      window.localStorage.setItem(STORAGE_KEY, value)
      window.dispatchEvent(new CustomEvent('marktext-math-macros-changed', {
        detail: { macros: parseMathMacros(value) }
      }))
    } catch (_) {
      // A read-only storage context should not prevent the editor from loading.
    }
  }

  window.marktextMathMacros = {
    key: STORAGE_KEY,
    parse: parseMathMacros,
    getRaw: getRaw,
    get: get,
    set: set
  }
})()

