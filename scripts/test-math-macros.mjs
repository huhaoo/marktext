import assert from 'node:assert/strict'
import katex from 'katex'
import { parseMathMacros } from '../packages/muyajs/lib/utils/mathMacros.js'

assert.deepEqual(parseMathMacros(String.raw`\R = \mathbb{R}
\norm = \left\lVert #1 \right\rVert`), {
  '\\R': '\\mathbb{R}',
  '\\norm': '\\left\\lVert #1 \\right\\rVert'
})

assert.deepEqual(parseMathMacros('{"\\\\R":"\\\\mathbb{R}"}'), {
  '\\R': '\\mathbb{R}'
})

assert.deepEqual(parseMathMacros(String.raw`ordinary text
% comment
\\bad name = ignored`), {})

const macros = parseMathMacros(String.raw`\norm = \left\lVert #1 \right\rVert`)
assert.doesNotThrow(() => katex.renderToString(String.raw`\norm{x}`, { macros }))

console.log('LaTeX macro parser: ok')
