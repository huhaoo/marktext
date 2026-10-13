// A deliberately small Pandoc-compatible subset: bracketed citations and pages.
export const parseCitation = (source) => {
  const match = /^\[@([^\]\n]+)\]/.exec(source)
  if (!match || /^[([]/.test(source.slice(match[0].length))) return null
  const items = []
  for (const part of (`@${match[1]}`).split(';')) {
    const item = /^\s*@([^\s,;[\]@]+)(?:\s*,\s*(pp?\.)\s+([^;]+))?\s*$/.exec(part)
    if (!item) return null
    items.push({ id: item[1], ...(item[3] ? { label: 'page', locator: item[3].trim() } : {}) })
  }
  return { raw: match[0], items }
}

// ASCII-only, collision-free anchors also work for keys containing ':' or '%'.
export const referenceId = (key) => `mt-ref-${Array.from(new TextEncoder().encode(key), byte => byte.toString(16).padStart(2, '0')).join('')}`

export const escapeCitationHtml = (value) => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char])

export const bibliographyCss = `
.mt-bibliography { margin-top: 2em; }
.mt-bibliography .csl-entry { margin-bottom: .6em; overflow-wrap: anywhere; }
.mt-bibliography .csl-left-margin { float: left; padding-right: .6em; }
.mt-bibliography .csl-right-inline { margin-left: 2.4em; }
.mt-bibliography .mt-hanging .csl-entry { padding-left: 2em; text-indent: -2em; }
.mt-bibliography .csl-entry:target { background: #fff2bd; }
`
