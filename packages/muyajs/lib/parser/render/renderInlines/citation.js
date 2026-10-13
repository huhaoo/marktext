import { CLASS_OR_ID, PREVIEW_DOMPURIFY_CONFIG } from '../../../config'
import { sanitize } from '../../../utils'
import { htmlToVNode } from '../snabbdom'

export default function citation(h, cursor, block, token, outerClass) {
  const active = this.muya.options.citationFocused !== false && [cursor.start, cursor.end].some(point => point?.key === block.key && point.offset > token.range.start && point.offset < token.range.end)
  const result = this.muya.options.citations?.inline.get(token.raw)
  const editing = active || !result || outerClass
  const raw = h('span.ag-citation-text', this.highlight(h, block, token.range.start, token.range.end, token))
  return [h(`span.ag-citation${editing ? '.ag-citation-editing' : ''}`, {
    attrs: { 'data-raw': token.raw, 'data-start': token.range.start, 'data-end': token.range.end, title: result?.title || token.raw }
  }, [raw, ...(result
    ? [h(`span.${CLASS_OR_ID.AG_CITATION_RENDER}`, {
      attrs: { contenteditable: 'false' }
    }, htmlToVNode(sanitize(result.html, PREVIEW_DOMPURIFY_CONFIG, false)))]
    : [])])]
}
