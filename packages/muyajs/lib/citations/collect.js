import marked from '../parser/marked'

export const collectCitations = (markdown, options = {}) => {
  const citations = []
  marked(markdown, {
    ...options,
    citationRenderer: (citation) => {
      citations.push(citation)
      return ''
    }
  })
  return citations
}
