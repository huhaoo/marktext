import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { parseMathMacros } from '../src/mathMacros.mjs'

const require = createRequire(import.meta.url)
const katex = require('../app/node_modules/katex')

const macros = parseMathMacros(String.raw`
% comments are allowed
\R = \mathbb{R}
\norm = \left\lVert #1 \right\rVert
not-a-macro = ignored
`)

assert.deepEqual(macros, {
  '\\R': '\\mathbb{R}',
  '\\norm': '\\left\\lVert #1 \\right\\rVert'
})

const rendered = katex.renderToString(String.raw`\norm{x} \in \R`, {
  displayMode: false,
  macros
})
assert.match(rendered, /x/)
assert.doesNotMatch(rendered, /Undefined control sequence/)

assert.deepEqual(parseMathMacros('plain \\R text'), {})
assert.deepEqual(parseMathMacros('{"\\\\Q":"\\\\mathbb{Q}"}'), {
  '\\Q': '\\mathbb{Q}'
})

console.log('math macro parser and KaTeX integration: ok')
