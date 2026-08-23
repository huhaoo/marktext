import assert from 'node:assert/strict'
import fs from 'node:fs'
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

const coreSource = fs.readFileSync(new URL('../app/out/renderer/math-macros-core.js', import.meta.url), 'utf8')
const preferencesSource = fs.readFileSync(new URL('../app/out/renderer/math-macros-preferences.js', import.meta.url), 'utf8')
const bundleSource = fs.readFileSync(new URL('../app/out/renderer/assets/index-B-PE276Q.js', import.meta.url), 'utf8')

assert.match(coreSource, /getCategoryLabel/)
assert.match(coreSource, /'zh-cn'/)
assert.match(coreSource, /LaTeX macros/)
assert.match(coreSource, /LaTeX 宏/)
assert.doesNotMatch(coreSource, /LaTeX aliases/)
assert.ok(!preferencesSource.includes('Math macros / 数学宏'))
assert.match(preferencesSource, /isFeaturesPage/)
assert.match(bundleSource, /path: "\/preference\/features"/)
assert.match(bundleSource, /path: "features"/)

console.log('math macro parser, KaTeX integration, Features route, and locale labels: ok')
