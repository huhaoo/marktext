(function () {
  'use strict'

  const STORAGE_KEY = 'marktext.mathMacros'
  const MACRO_NAME = /^\\(?:[A-Za-z@]+|[^A-Za-z\s])$/
  const LABELS = {
    en: {
      category: 'Features',
      title: 'LaTeX macros',
      note: 'Define one LaTeX macro per line. Example: \\R = \\mathbb{R}   |   \\norm = \\left\\lVert #1 \\right\\rVert',
      clear: 'Clear',
      saved: 'Saved locally; re-render the formula to apply changes'
    },
    'zh-cn': {
      category: '功能',
      title: 'LaTeX 宏',
      note: '每行定义一个 LaTeX 宏。示例：\\R = \\mathbb{R}   |   \\norm = \\left\\lVert #1 \\right\\rVert',
      clear: '清空',
      saved: '已保存；重新渲染公式后生效'
    },
    'zh-tw': {
      category: '功能',
      title: 'LaTeX 宏',
      note: '每行定義一個 LaTeX 宏。範例：\\R = \\mathbb{R}   |   \\norm = \\left\\lVert #1 \\right\\rVert',
      clear: '清除',
      saved: '已儲存；重新渲染公式後生效'
    },
    es: {
      category: 'Funciones',
      title: 'Macros de LaTeX',
      note: 'Defina un macro de LaTeX por línea. Ejemplo: \\R = \\mathbb{R}   |   \\norm = \\left\\lVert #1 \\right\\rVert',
      clear: 'Borrar',
      saved: 'Guardado localmente; vuelva a renderizar la fórmula para aplicar los cambios'
    },
    fr: {
      category: 'Fonctionnalités',
      title: 'Macros LaTeX',
      note: 'Définissez une macro LaTeX par ligne. Exemple : \\R = \\mathbb{R}   |   \\norm = \\left\\lVert #1 \\right\\rVert',
      clear: 'Effacer',
      saved: 'Enregistré localement ; actualisez la formule pour appliquer les changements'
    },
    de: {
      category: 'Funktionen',
      title: 'LaTeX-Makros',
      note: 'Definieren Sie ein LaTeX-Makro pro Zeile. Beispiel: \\R = \\mathbb{R}   |   \\norm = \\left\\lVert #1 \\right\\rVert',
      clear: 'Löschen',
      saved: 'Lokal gespeichert; rendern Sie die Formel neu, um Änderungen anzuwenden'
    },
    ja: {
      category: '機能',
      title: 'LaTeX マクロ',
      note: '1 行に 1 つの LaTeX マクロを定義します。例: \\R = \\mathbb{R}   |   \\norm = \\left\\lVert #1 \\right\\rVert',
      clear: 'クリア',
      saved: 'ローカルに保存しました。数式を再描画すると適用されます'
    },
    ko: {
      category: '기능',
      title: 'LaTeX 매크로',
      note: '한 줄에 하나의 LaTeX 매크로를 정의합니다. 예: \\R = \\mathbb{R}   |   \\norm = \\left\\lVert #1 \\right\\rVert',
      clear: '지우기',
      saved: '로컬에 저장되었습니다. 수식을 다시 렌더링하면 적용됩니다'
    },
    pt: {
      category: 'Funcionalidades',
      title: 'Macros LaTeX',
      note: 'Defina uma macro LaTeX por linha. Exemplo: \\R = \\mathbb{R}   |   \\norm = \\left\\lVert #1 \\right\\rVert',
      clear: 'Limpar',
      saved: 'Guardado localmente; renderize a fórmula novamente para aplicar'
    }
  }

  function normalizeLocale(locale) {
    return String(locale || 'en').replace('_', '-').toLowerCase()
  }

  function getDetectedLocale() {
    try {
      const i18n = window.__VUE_I18N__
      const global = i18n && (typeof i18n.global === 'function' ? i18n.global() : i18n.global)
      const locale = global && (typeof global.locale === 'string' ? global.locale : global.locale?.value)
      if (locale) {
        return normalizeLocale(locale)
      }
    } catch (_) {
      // Fall back to the document/browser language.
    }
    return normalizeLocale(document.documentElement?.lang || navigator.language || 'en')
  }

  let activeLocale = getDetectedLocale()

  function getLabels() {
    const baseLocale = activeLocale.split('-')[0]
    return LABELS[activeLocale] || LABELS[baseLocale] || LABELS.en
  }

  function setLocale(locale) {
    if (locale) {
      activeLocale = normalizeLocale(locale)
      window.dispatchEvent(new CustomEvent('marktext-math-macros-language-changed'))
    }
  }

  let languageEventsBound = false
  function bindLanguageEvents() {
    if (languageEventsBound) {
      return
    }

    const ipc = window.electron?.ipcRenderer
    if (!ipc?.on) {
      return
    }

    languageEventsBound = true
    const handleLanguage = (_event, locale) => setLocale(locale)
    ipc.on('language-changed', handleLanguage)
    ipc.on('mt::current-language', handleLanguage)
    ipc.send?.('mt::get-current-language')
  }

  bindLanguageEvents()
  window.setTimeout(bindLanguageEvents, 0)

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
    set: set,
    getLabels: getLabels,
    getCategoryLabel: function () {
      return getLabels().category
    },
    getLocale: function () {
      return activeLocale
    }
  }
})()
