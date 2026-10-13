import { Cite, plugins } from '@citation-js/core'
import '@citation-js/plugin-bibtex'
import '@citation-js/plugin-csl'
import CSL from 'citeproc'
import { escapeCitationHtml, referenceId } from './syntax'
import ieee from './ieee.csl?raw'

const config = plugins.config.get('@csl')

export const parseBibliography = (sources) => {
  const entries = []
  const keys = new Set()
  for (const { text, path } of sources) {
    const parsed = new Cite(text, { forceType: '@biblatex/text' }).data
    for (const item of parsed) {
      const id = String(item.id)
      if (keys.has(id)) throw new Error(`Duplicate citation key: ${id} (${path})`)
      keys.add(id)
      entries.push({ ...item, id })
    }
  }
  return entries
}

export { collectCitations } from './collect'

export const formatCitations = (entries, citations, style = 'ieee', title = 'References', validate = true) => {
  const xml = style === 'ieee' ? ieee : style === 'apa' ? config.templates.get('apa') : style
  if (validate) {
    const document = new DOMParser().parseFromString(xml, 'application/xml')
    if (document.querySelector('parsererror') || document.documentElement.localName !== 'style') {
      throw new Error('Invalid CSL style')
    }
    if (document.documentElement.getAttribute('class') !== 'in-text' || !document.querySelector('citation')) {
      throw new Error('Choose an independent in-text CSL style')
    }
  }
  const byId = new Map(entries.map(item => [item.id, item]))
  const missing = [...new Set(citations.flatMap(citation => citation.items.map(item => item.id)))].filter(id => !byId.has(id))
  const valid = citations.filter(citation => citation.items.every(item => byId.has(item.id)))
  const engine = new CSL.Engine({
    retrieveLocale: (lang) => config.locales.get(lang) || config.locales.get('en-US'),
    retrieveItem: (id) => byId.get(id)
  }, xml)
  engine.setOutputFormat('html')
  const outputs = []
  const preceding = []
  valid.forEach((citation, index) => {
    const id = `citation-${index}`
    const result = engine.processCitationCluster({
      citationID: id,
      citationItems: citation.items,
      properties: { noteIndex: 0 }
    }, preceding, [])
    for (const [position, html] of result[1]) outputs[position] = html
    preceding.push([id, 0])
  })
  const inline = new Map()
  valid.forEach((citation, index) => {
    const description = citation.items.map(item => {
      const entry = byId.get(item.id)
      return `${entry.title || item.id} (${item.id})`
    }).join('\n')
    inline.set(citation.raw, {
      html: `<a class="mt-citation-link" href="#${referenceId(citation.items[0].id)}" title="${escapeCitationHtml(description)}">${outputs[index]}</a>`,
      title: description
    })
  })
  const bibliography = engine.makeBibliography()
  let html = ''
  if (bibliography && bibliography[1].length) {
    const [params, rows] = bibliography
    const content = rows.map((row, index) => `<div id="${referenceId(params.entry_ids[index][0])}">${row}</div>`).join('\n')
    html = `<section class="mt-bibliography" id="mt-references"><h2>${escapeCitationHtml(title)}</h2><div class="${params.hangingindent ? 'mt-hanging' : ''}">${content}</div></section>`
  }
  return { inline, bibliography: html, missing }
}
