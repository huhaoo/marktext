import { citationCompletionContext, citationReplacement, searchCitations, type CitationContext } from 'muya/lib/citations/completion'
import selection from 'muya/lib/selection'
import { citationState } from './citations'
import { t } from '@/i18n'
import '@/assets/styles/citations.css'

interface Context extends CitationContext { key?: string; line?: number; rect: DOMRect | { left: number; bottom: number } }
interface Adapter { scope: HTMLElement; context(): Context | null; replace(context: Context, text: string): void }
// These two adapters sit at the intentionally untyped legacy-editor boundary.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LegacyEditor = any

export class CitationCompletion {
  private box = document.createElement('div')
  private context: Context | null = null
  private items = citationState.entries.slice(0, 0)
  private active = 0
  private composing = false
  private dismissed = ''
  private timer?: ReturnType<typeof setTimeout>

  constructor(private adapter: Adapter) {
    this.box.className = 'mt-citation-completion'
    this.box.hidden = true
    this.box.setAttribute('role', 'listbox')
    document.body.appendChild(this.box)
    document.addEventListener('keydown', this.keydown, true)
    adapter.scope.addEventListener('input', this.schedule)
    adapter.scope.addEventListener('keyup', this.schedule)
    adapter.scope.addEventListener('compositionstart', this.startComposition)
    adapter.scope.addEventListener('compositionend', this.endComposition)
    document.addEventListener('selectionchange', this.schedule)
    document.addEventListener('mousedown', this.outside)
  }

  private startComposition = () => { this.composing = true; this.hide() }
  private endComposition = () => { this.composing = false; this.schedule() }
  private outside = (event: MouseEvent) => {
    if (!this.adapter.scope.contains(event.target as Node) && !this.box.contains(event.target as Node)) this.hide()
  }

  private schedule = () => {
    clearTimeout(this.timer)
    this.timer = setTimeout(() => this.update(), 40)
  }

  private signature = (context: Context) => `${context.key || context.line}:${context.start}:${context.query}`
  update = () => {
    if (this.composing || !citationState.enabled) return this.hide()
    const context = this.adapter.context()
    if (!context || this.signature(context) === this.dismissed) return this.hide()
    this.context = context
    this.items = searchCitations(citationState.entries, context.query)
    this.active = 0
    this.box.style.left = `${Math.max(8, Math.min(context.rect.left, window.innerWidth - 440))}px`
    this.box.style.top = `${Math.max(8, Math.min(context.rect.bottom + 5, window.innerHeight - 290))}px`
    this.box.hidden = false
    this.render()
  }

  private render = () => {
    this.box.replaceChildren()
    if (!this.items.length) {
      const message = document.createElement('div')
      message.className = 'mt-citation-empty'
      message.textContent = citationState.loading ? t('citations.loading') : citationState.error || t('citations.noMatches')
      this.box.appendChild(message)
      return
    }
    this.items.forEach((entry, index) => {
      const item = document.createElement('div')
      item.setAttribute('role', 'option')
      item.setAttribute('aria-selected', String(index === this.active))
      item.className = index === this.active ? 'mt-citation-option active' : 'mt-citation-option'
      const title = document.createElement('strong')
      title.textContent = entry.title || entry.id
      const details = document.createElement('small')
      const authors = entry.author?.map(person => person.literal || person.family || person.given).join(', ') || ''
      details.textContent = `${entry.id} · ${authors} · ${entry.issued?.['date-parts']?.[0]?.[0] || ''}`
      item.append(title, details)
      item.addEventListener('mousedown', event => { event.preventDefault(); this.active = index; this.accept() })
      this.box.appendChild(item)
    })
    this.box.children[this.active]?.scrollIntoView?.({ block: 'nearest' })
  }

  private accept = () => {
    const current = this.adapter.context()
    const entry = this.items[this.active]
    if (entry && current && this.context && this.signature(current) === this.signature(this.context)) {
      this.adapter.replace(current, citationReplacement(current, entry.id))
      this.dismissed = `${current.key || current.line}:${current.start}:${entry.id}`
    }
    this.hide()
  }

  private keydown = (event: KeyboardEvent) => {
    if (event.isComposing || event.keyCode === 229 || this.composing || !citationState.enabled || !this.adapter.scope.contains(event.target as Node) || event.ctrlKey || event.metaKey || event.altKey) return
    const current = this.adapter.context()
    if (!current) return this.hide()
    if (this.signature(current) === this.dismissed) return
    // Input and key events can arrive before the debounced popup update.
    // Confirm against the latest query rather than dropping a fast Enter.
    if (!this.context || this.signature(current) !== this.signature(this.context)) {
      this.context = current
      this.items = searchCitations(citationState.entries, current.query)
      this.active = 0
      this.render()
    }
    if (event.key === 'Escape') {
      this.dismissed = this.context ? this.signature(this.context) : ''
      this.hide()
    } else if (this.items.length && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
      this.active = (this.active + (event.key === 'ArrowDown' ? 1 : -1) + this.items.length) % this.items.length
      this.render()
    } else if (this.items.length && ['Enter', 'Tab'].includes(event.key)) this.accept()
    else return
    event.preventDefault()
    event.stopImmediatePropagation()
  }

  hide = () => { this.box.hidden = true; this.context = null }
  destroy = () => {
    clearTimeout(this.timer)
    document.removeEventListener('keydown', this.keydown, true)
    this.adapter.scope.removeEventListener('input', this.schedule)
    this.adapter.scope.removeEventListener('keyup', this.schedule)
    this.adapter.scope.removeEventListener('compositionstart', this.startComposition)
    this.adapter.scope.removeEventListener('compositionend', this.endComposition)
    document.removeEventListener('selectionchange', this.schedule)
    document.removeEventListener('mousedown', this.outside)
    this.box.remove()
  }
}

export const muyaCitationCompletion = (muya: LegacyEditor) => new CitationCompletion({
  scope: muya.container,
  context: () => {
    if (!muya.container.contains(document.activeElement)) return null
    const cursor = selection.getCursorRange()
    if (!cursor.start || !cursor.end || cursor.start.key !== cursor.end.key || cursor.start.offset !== cursor.end.offset) return null
    const block = muya.contentState.getBlock(cursor.start.key)
    if (!block || !/paragraphContent|atxLine|cellContent/.test(block.functionType)) return null
    const context = citationCompletionContext(block.text, cursor.start.offset)
    const range = window.getSelection()?.getRangeAt(0)
    return context && range ? { ...context, key: block.key, rect: range.getBoundingClientRect() } : null
  },
  replace: (context, text) => {
    const state = muya.contentState
    const block = state.getBlock(context.key)
    if (!block) return
    state.history.commitPending()
    state.cursor = { start: { key: block.key, offset: context.start }, end: { key: block.key, offset: context.end } }
    const line = { start: { key: block.key, offset: 0, block }, end: { key: block.key, offset: block.text.length, block } }
    state.replaceWordInline(line, { start: { key: block.key, offset: context.start }, end: { key: block.key, offset: context.end } }, text, true)
    const after = context.start + text.length
    if (block.text[after] === ']') {
      state.cursor = { start: { key: block.key, offset: after + 1 }, end: { key: block.key, offset: after + 1 }, noHistory: true }
      state.setCursor()
    }
    state.history.commitPending()
  }
})

export const sourceCitationCompletion = (cm: LegacyEditor) => new CitationCompletion({
  scope: cm.getWrapperElement(),
  context: () => {
    if (!cm.hasFocus() || cm.somethingSelected()) return null
    const cursor = cm.getCursor()
    const token = cm.getTokenAt(cursor, true)
    if (/comment|code|math|meta|tag/.test(token.type || '')) return null
    const context = citationCompletionContext(cm.getLine(cursor.line), cursor.ch)
    const rect = cm.cursorCoords(cursor, 'window')
    return context ? { ...context, line: cursor.line, rect } : null
  },
  replace: (context, text) => {
    cm.replaceRange(text, { line: context.line, ch: context.start }, { line: context.line, ch: context.end }, 'complete')
    const after = context.start + text.length
    cm.setCursor({ line: context.line, ch: after + (cm.getLine(context.line)[after] === ']' ? 1 : 0) })
    cm.focus()
  }
})
