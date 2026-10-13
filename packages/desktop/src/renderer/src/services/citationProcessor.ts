import type { Citation, CitationEntry, FormattedCitations, ParsedBibliography } from 'muya/lib/citations/engine'

// The expensive BibTeX/CSL work never runs on the editor's UI thread.
let worker: Worker | undefined
let nextId = 0
const pending = new Map<number, { resolve: (result: unknown) => void; reject: (error: Error) => void }>()
const request = <T>(message: Record<string, unknown>): Promise<T> => {
  if (!worker) {
    worker = new Worker(new URL('./citationWorker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<{ id: number; result?: unknown; error?: string }>) => {
      const job = pending.get(event.data.id)
      if (!job) return
      pending.delete(event.data.id)
      if (event.data.error) job.reject(new Error(event.data.error))
      else job.resolve(event.data.result)
    }
    worker.onerror = (event) => {
      for (const job of pending.values()) job.reject(new Error(event.message || 'Citation worker failed'))
      pending.clear()
      worker?.terminate()
      worker = undefined
    }
  }
  const id = ++nextId
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: value => resolve(value as T), reject })
    worker!.postMessage({ ...message, id })
  })
}
export const parseBibliography = (sources: Array<{ path: string; text: string }>) => request<ParsedBibliography>({ command: 'parse', sources })
export const formatCitations = (entries: CitationEntry[], citations: Citation[], style: string, title: string) => {
  if (style !== 'ieee' && style !== 'apa') {
    const xml = new DOMParser().parseFromString(style, 'application/xml')
    if (xml.querySelector('parsererror') || xml.documentElement.localName !== 'style') throw new Error('Invalid CSL style')
    if (xml.documentElement.getAttribute('class') !== 'in-text' || !xml.querySelector('citation')) throw new Error('Choose an independent in-text CSL style')
  }
  return request<FormattedCitations>({ command: 'format', entries, citations, style, title })
}
