declare module 'muya/lib/citations/engine' {
  export interface CitationEntry {
    id: string;
    title?: string;
    author?: Array<{ family?: string; given?: string; literal?: string }>;
    issued?: { 'date-parts'?: number[][] };
    [field: string]: unknown
  }
  export interface Citation { raw: string; items: Array<{ id: string; label?: string; locator?: string }> }
  export interface FormattedCitations {
    inline: Map<string, { html: string; title: string }>;
    bibliography: string;
    missing: string[]
  }
  export function parseBibliography(sources: Array<{ path: string; text: string }>): CitationEntry[]
  export interface ParsedBibliography { entries: CitationEntry[]; skipped: number }
  export function parseBibliographyWithDiagnostics(sources: Array<{ path: string; text: string }>): ParsedBibliography
  export function collectCitations(markdown: string, options?: Record<string, unknown>): Citation[]
  export function formatCitations(entries: CitationEntry[], citations: Citation[], style?: string, title?: string, validate?: boolean): FormattedCitations
}
declare module 'muya/lib/citations/missingKeys' {
  export function omitMissingKeyEntries(text: string): { text: string; skipped: number }
}
declare module 'muya/lib/citations/collect' {
  import type { Citation } from 'muya/lib/citations/engine'
  export function collectCitations(markdown: string, options?: Record<string, unknown>): Citation[]
}
declare module 'muya/lib/citations/completion' {
  import type { CitationEntry } from 'muya/lib/citations/engine'
  export interface CitationContext { start: number; end: number; query: string; addClosing: boolean }
  export function citationCompletionContext(text: string, offset: number): CitationContext | null
  export function citationReplacement(context: CitationContext, key: string): string
  export function searchCitations(entries: CitationEntry[], query: string, limit?: number): CitationEntry[]
}
declare module 'muya/lib/citations/syntax' {
  import type { Citation } from 'muya/lib/citations/engine'
  export function parseCitation(source: string): Citation | null
  export function referenceId(key: string): string
  export const bibliographyCss: string
}
declare module 'muya/lib/selection' {
  const selection: { getCursorRange(): { start?: { key: string; offset: number }; end?: { key: string; offset: number } } }
  export default selection
}
