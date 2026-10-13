import { parseBibliographyWithDiagnostics, formatCitations } from 'muya/lib/citations/engine'
import type { Citation, CitationEntry } from 'muya/lib/citations/engine'

type Request = { id: number } & (
  { command: 'parse'; sources: Array<{ path: string; text: string }> } |
  { command: 'format'; entries: CitationEntry[]; citations: Citation[]; style: string; title: string }
)
self.addEventListener('message', (event: MessageEvent<Request>) => {
  const request = event.data
  try {
    const result = request.command === 'parse'
      ? parseBibliographyWithDiagnostics(request.sources)
      : formatCitations(request.entries, request.citations, request.style, request.title, false)
    self.postMessage({ id: request.id, result })
  } catch (error) {
    self.postMessage({ id: request.id, error: error instanceof Error ? error.message : String(error) })
  }
})
