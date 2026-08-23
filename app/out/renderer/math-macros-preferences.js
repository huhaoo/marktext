(function () {
  'use strict'

  const CONTROL_ID = 'marktext-math-macros'

  function isPreferencePage() {
    return Boolean(document.querySelector('.pref-container'))
  }

  function isFeaturesPage() {
    return /#\/preference\/features(?:[/?#]|$)/.test(window.location.hash)
  }

  function addControl() {
    if (!isPreferencePage() || !isFeaturesPage()) {
      return
    }

    const container = document.querySelector('.pref-setting')
    if (!container || document.getElementById(CONTROL_ID)) {
      const existing = document.getElementById(CONTROL_ID)
      if (existing) {
        updateLabels(existing)
      }
      return
    }

    const core = window.marktextMathMacros
    if (!core) {
      return
    }

    const section = document.createElement('section')
    section.id = CONTROL_ID
    section.className = 'pref-compound-item'
    section.style.cssText = 'font-size:14px;user-select:none;margin:32px 0;color:var(--editorColor);width:100%;'

    const title = document.createElement('h6')
    title.style.cssText = 'padding-bottom:6px;margin:0;color:var(--editorColor);font-size:15px;font-weight:500;'

    const notes = document.createElement('div')
    notes.style.cssText = 'margin:8px 0 10px;font-size:12px;line-height:1.5;color:var(--editorColor80);user-select:text;'

    const textarea = document.createElement('textarea')
    textarea.rows = 7
    textarea.spellcheck = false
    textarea.value = core.getRaw()
    textarea.placeholder = '\\R = \\mathbb{R}\n\\norm = \\left\\lVert #1 \\right\\rVert'
    textarea.style.cssText = 'display:block;width:100%;min-height:140px;box-sizing:border-box;resize:vertical;padding:8px 10px;border:1px solid var(--editorColor10);border-radius:3px;background:transparent;color:var(--editorColor);font:13px/1.5 monospace;user-select:text;'

    const footer = document.createElement('div')
    footer.style.cssText = 'display:flex;align-items:center;gap:10px;margin-top:8px;'

    const clear = document.createElement('button')
    clear.type = 'button'
    clear.style.cssText = 'padding:4px 10px;border:1px solid var(--editorColor10);border-radius:3px;background:transparent;color:var(--editorColor);cursor:pointer;'

    const status = document.createElement('span')
    status.style.cssText = 'font-size:12px;color:var(--editorColor60);'

    function updateLabels(section) {
      const labels = core.getLabels?.() || {
        title: 'LaTeX macros',
        note: 'Define one LaTeX macro per line.',
        clear: 'Clear',
        saved: 'Saved locally'
      }
      section.querySelector('h6').textContent = labels.title
      section.querySelector('[data-role="notes"]').textContent = labels.note
      section.querySelector('[data-role="clear"]').textContent = labels.clear
      section.querySelector('[data-role="status"]').textContent = labels.saved
    }

    function save() {
      core.set(textarea.value)
      status.textContent = (core.getLabels?.() || { saved: 'Saved locally' }).saved
    }

    textarea.addEventListener('input', save)
    clear.addEventListener('click', function () {
      textarea.value = ''
      save()
    })

    notes.dataset.role = 'notes'
    clear.dataset.role = 'clear'
    status.dataset.role = 'status'
    footer.append(clear, status)
    section.append(title, notes, textarea, footer)
    container.appendChild(section)
    updateLabels(section)
  }

  function schedule() {
    window.setTimeout(addControl, 0)
  }

  const observer = new MutationObserver(schedule)
  observer.observe(document.documentElement, { childList: true, subtree: true })
  document.addEventListener('DOMContentLoaded', schedule)
  window.addEventListener('languageChanged', schedule)
  window.addEventListener('marktext-math-macros-language-changed', schedule)
  window.addEventListener('hashchange', schedule)
  schedule()
})()
