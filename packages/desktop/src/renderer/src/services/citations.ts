import { shallowReactive } from 'vue'
import { parseDocument, isMap } from 'yaml'
import { t } from '@/i18n'
import runSanitize from 'muya/lib/utils/dompurify'
import type { CitationEntry, FormattedCitations } from 'muya/lib/citations/engine'
import { collectCitations } from 'muya/lib/citations/collect'
import type * as CitationProcessor from './citationProcessor'

export interface CitationDocument { id: string; pathname?: string; markdown: string; isSaved?: boolean }
export interface CitationConfig { bibliography: string[]; csl: string; title: string }

export const readCitationConfig = (markdown: string): CitationConfig | null => {
  const match = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(markdown)
  if (!match) return null
  const yaml = parseDocument(match[1])
  // An unrelated front matter must not enable the citation extension.
  if (!isMap(yaml.contents) || !yaml.has('bibliography')) return null
  if (yaml.errors.length) throw new Error(yaml.errors[0].message)
  const value: unknown = yaml.toJS().bibliography
  const paths = Array.isArray(value) ? value : [value]
  if (!paths.length || paths.some(path => typeof path !== 'string' || !path.trim())) {
    throw new Error(t('citations.invalidBibliography'))
  }
  const csl = yaml.get('csl') ?? 'ieee'
  const title = yaml.get('reference-section-title') ?? t('citations.references')
  if (typeof csl !== 'string' || typeof title !== 'string') throw new Error(t('citations.invalidConfig'))
  return { bibliography: paths as string[], csl, title }
}

export const writeCitationConfig = (markdown: string, config: CitationConfig): string => {
  const match = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(markdown)
  const yaml = parseDocument(match?.[1] || '')
  if (yaml.errors.length || (yaml.contents && !isMap(yaml.contents))) throw new Error(t('citations.invalidConfig'))
  yaml.set('bibliography', config.bibliography.length === 1 ? config.bibliography[0] : config.bibliography)
  yaml.set('csl', config.csl)
  yaml.set('reference-section-title', config.title)
  return `---\n${yaml.toString()}---\n${match ? markdown.slice(match[0].length) : `\n${markdown}`}`
}

export const citationState = shallowReactive({
  documentId: '',
  enabled: false,
  loading: false,
  error: '',
  notice: '',
  entries: [] as CitationEntry[],
  inline: new Map<string, { html: string; title: string }>(),
  bibliography: '',
  bibliographyTitle: '',
  pending: false,
  revision: 0
})

interface Resources { entries: CitationEntry[]; skipped: number; style: string; version: string }
interface Session {
  version: number;
  configKey: string;
  resources?: Resources;
  formatKey: string;
  result?: FormattedCitations;
  savedKey?: string;
  savedBibliography: string;
  savedTitle: string
  savedVersion: number
}
const sessions = new Map<string, Session>()
const fileCache = new Map<string, { stamp: string; text: string }>()
let enginePromise: Promise<typeof CitationProcessor> | undefined
const getEngine = () => (enginePromise ||= import('./citationProcessor'))
let formatCount = 0

const readLocal = async(path: string, check: boolean): Promise<string> => {
  const cached = fileCache.get(path)
  if (cached && !check) return cached.text
  const stat = await window.fileUtils.stat(path)
  if (!stat.isFile) throw new Error(`${t('citations.fileError')}: ${path}`)
  const stamp = `${stat.mtimeMs}:${stat.size}`
  if (cached?.stamp === stamp) return cached.text
  const data = await window.fileUtils.readFile(path, 'utf8')
  const text = typeof data === 'string' ? data : new TextDecoder().decode(data)
  fileCache.set(path, { stamp, text })
  return text
}

const resolvePath = (path: string, pathname?: string): string => {
  if (/^[a-z]+:\/\//i.test(path)) throw new Error(t('citations.localOnly'))
  if (window.path.isAbsolute(path)) return path
  if (!pathname) throw new Error(t('citations.saveFirst'))
  return window.path.resolve(window.path.dirname(pathname), path)
}

export const activateCitations = (id: string) => {
  if (citationState.documentId === id) return
  Object.assign(citationState, { documentId: id, enabled: false, loading: false, error: '', notice: '', entries: [], inline: new Map(), bibliography: '', bibliographyTitle: '', pending: false })
}

export const updateCitations = async(
  doc: CitationDocument,
  options: { saved?: boolean; refresh?: boolean; footnote?: boolean; superSubScript?: boolean } = {}
): Promise<FormattedCitations | undefined> => {
  let session = sessions.get(doc.id)
  if (!session) {
    session = { version: 0, configKey: '', formatKey: '', savedBibliography: '', savedTitle: '', savedVersion: 0 }
    sessions.set(doc.id, session)
  }
  const version = ++session.version
  const savedVersion = options.saved ? ++session.savedVersion : session.savedVersion
  let config: CitationConfig | null
  try {
    config = readCitationConfig(doc.markdown)
    if (!config) {
      if (options.saved) { session.savedBibliography = ''; session.savedKey = ''; session.savedTitle = '' }
      if (citationState.documentId === doc.id) Object.assign(citationState, { enabled: false, loading: false, entries: [], inline: new Map(), error: '', notice: '', bibliography: session.savedBibliography, bibliographyTitle: session.savedTitle, pending: !!session.savedBibliography })
      return undefined
    }
    if (citationState.documentId === doc.id) {
      citationState.enabled = true
      citationState.loading = !session.resources
    }
    const configKey = JSON.stringify([doc.pathname, config])
    const engine = await getEngine()
    const sources = await Promise.all(config.bibliography.map(async(path) => {
      const resolved = resolvePath(path, doc.pathname)
      return { path: resolved, text: await readLocal(resolved, !!options.refresh) }
    }))
    const style = ['ieee', 'apa'].includes(config.csl) ? config.csl : await readLocal(resolvePath(config.csl, doc.pathname), !!options.refresh)
    const resourceVersion = JSON.stringify([sources, style])
    const resources = session.resources?.version === resourceVersion
      ? session.resources
      : { ...await engine.parseBibliography(sources), style, version: resourceVersion }
    const citations = collectCitations(doc.markdown, { footnote: options.footnote, superSubScript: options.superSubScript })
    const formatKey = JSON.stringify([configKey, resourceVersion, citations])
    let result = session.result
    if (session.formatKey !== formatKey || !result) {
      result = await engine.formatCitations(resources.entries, citations, style, config.title)
      result = { ...result, bibliography: runSanitize(result.bibliography), inline: new Map([...result.inline].map(([key, value]) => [key, { ...value, html: runSanitize(value.html) }])) }
      formatCount++
    }
    // Save acknowledgements contain the exact persisted text, even if the user
    // continued editing while the write was in flight.
    if (session.savedVersion === savedVersion && (options.saved || (session.savedKey === undefined && doc.pathname && doc.isSaved !== false))) {
      session.savedBibliography = result.bibliography
      session.savedTitle = config.title
      session.savedKey = formatKey
    }
    if (session.version !== version) return result
    session.resources = resources
    session.configKey = configKey
    session.formatKey = formatKey
    session.result = result
    if (citationState.documentId === doc.id) {
      Object.assign(citationState, {
        enabled: true,
        loading: false,
        entries: resources.entries,
        inline: result.inline,
        bibliography: session.savedBibliography,
        bibliographyTitle: session.savedTitle,
        pending: session.savedKey !== formatKey,
        error: result.missing.length ? `${t('citations.missingKeys')}: ${result.missing.join(', ')}` : '',
        notice: resources.skipped ? t('citations.skippedEntries', { count: resources.skipped }) : '',
        revision: citationState.revision + Number(citationState.inline !== result.inline)
      })
    }
    return result
  } catch (error) {
    if (session.version === version && citationState.documentId === doc.id) {
      Object.assign(citationState, { enabled: true, loading: false, entries: [], inline: new Map(), notice: '', bibliography: session.savedBibliography, bibliographyTitle: session.savedTitle, error: error instanceof Error ? error.message : String(error), revision: citationState.revision + 1 })
    }
    throw error
  }
}

export const citationFormatCount = () => formatCount

export const prepareCitationExport = async(doc: CitationDocument, options: { footnote?: boolean; superSubScript?: boolean }) => {
  const result = await updateCitations(doc, { ...options, refresh: true })
  if (result?.missing.length) throw new Error(`${t('citations.missingKeys')}: ${result.missing.join(', ')}`)
  return result
}
