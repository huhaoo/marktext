import { watch } from 'vue'
import selection from 'muya/lib/selection'
import { citationState } from './citations'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const attachCitationRendering = (muya: any) => {
  const scope: HTMLElement = muya.container
  let timer: ReturnType<typeof setTimeout> | undefined
  const toggle = () => {
    const cursor = selection.getCursorRange()
    const focused = !!cursor.start && scope.contains(document.activeElement)
    muya.options.citationFocused = focused
    for (const node of scope.querySelectorAll<HTMLElement>('.ag-citation')) {
      const key = node.closest('.ag-paragraph')?.id
      const active = focused && [cursor.start, cursor.end].some(point => point && point.key === key && point.offset > Number(node.dataset.start) && point.offset < Number(node.dataset.end))
      node.classList.toggle('ag-citation-editing', active || !node.querySelector('.ag-citation-render'))
    }
  }
  const schedule = () => { clearTimeout(timer); timer = setTimeout(toggle, 0) }
  const stop = watch(() => [citationState.revision, citationState.documentId, citationState.enabled], () => {
    muya.options.citations = citationState.enabled ? { inline: citationState.inline, bibliography: '' } : undefined
    const state = muya.contentState
    const cursor = selection.getCursorRange()
    const focused = !!cursor.start && scope.contains(document.activeElement)
    muya.options.citationFocused = focused
    state.stateRender.tokenCache.clear()
    state.stateRender.collectLabels(state.blocks)
    state.stateRender.render(state.blocks, state.getActiveBlocks(), state.searchMatches.matches)
    if (focused) state.setCursor()
    toggle()
  }, { immediate: true })
  const mousedown = (event: MouseEvent) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('.ag-citation-render')
    if (!target) return
    const link = target.querySelector('a')
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault()
      event.stopImmediatePropagation()
      const id = link?.getAttribute('href')?.slice(1)
      if (id) {
        const reference = document.getElementById(id)
        const details = reference?.closest('details')
        if (details) details.open = true
        reference?.scrollIntoView({ block: 'center' })
      }
      return
    }
    const citation = target.closest<HTMLElement>('.ag-citation')
    const key = citation?.closest('.ag-paragraph')?.id
    if (!key || !citation) return
    event.preventDefault()
    event.stopImmediatePropagation()
    scope.focus()
    const offset = Number(citation.dataset.start) + 2
    muya.contentState.cursor = { start: { key, offset }, end: { key, offset }, noHistory: true }
    citation.classList.add('ag-citation-editing')
    muya.contentState.setCursor()
    schedule()
  }
  document.addEventListener('selectionchange', schedule)
  scope.addEventListener('focusin', schedule)
  scope.addEventListener('focusout', schedule)
  scope.addEventListener('mousedown', mousedown, true)
  return () => {
    clearTimeout(timer)
    stop()
    document.removeEventListener('selectionchange', schedule)
    scope.removeEventListener('focusin', schedule)
    scope.removeEventListener('focusout', schedule)
    scope.removeEventListener('mousedown', mousedown, true)
  }
}
