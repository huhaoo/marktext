import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const bundlePath = path.join(repoRoot, 'app', 'out', 'renderer', 'assets', 'index-B-PE276Q.js')
const indexPath = path.join(repoRoot, 'app', 'out', 'renderer', 'index.html')

const read = (file) => fs.readFileSync(file, 'utf8')
const write = (file, value) => fs.writeFileSync(file, value, 'utf8')

function replaceOnce(source, search, replacement, label) {
  const index = source.indexOf(search)
  if (index < 0) {
    throw new Error('Could not find ' + label + '; this bundle is not the expected v0.19.1 shape.')
  }
  if (source.indexOf(search, index + search.length) >= 0) {
    throw new Error('Found more than one ' + label + '; refusing an ambiguous patch.')
  }
  return source.slice(0, index) + replacement + source.slice(index + search.length)
}

let bundle = read(bundlePath)
const marker = '/* MARKTEXT_MATH_MACROS_PATCH */'
if (!bundle.includes(marker)) {
  const tick = String.fromCharCode(96)
  const inlinePrefix = [
    '  const { loadMathMap } = this;',
    '  const displayMode = false;',
    '  const key = ' + tick + '$' + '{math2}_$' + '{type5}' + tick + ';'
  ].join('\n')
  const inlineReplacement = [
    '  const { loadMathMap } = this;',
    '  const displayMode = false;',
    '  const macros = window.marktextMathMacros?.get?.() || {};',
    '  const key = ' + tick + '$' + '{math2}_$' + '{type5}_$' + '{JSON.stringify(macros)}' + tick + ';'
  ].join('\n')
  bundle = replaceOnce(bundle, inlinePrefix, inlineReplacement, 'inline-math cache setup')

  const inlineRender = [
    '      const html2 = katex$2.renderToString(math2, {',
    '        displayMode',
    '      });'
  ].join('\n')
  const inlineRenderReplacement = [
    '      const html2 = katex$2.renderToString(math2, {',
    '        displayMode,',
    '        macros',
    '      });'
  ].join('\n')
  bundle = replaceOnce(bundle, inlineRender, inlineRenderReplacement, 'inline-math KaTeX call')

  const blockPrefix = [
    '        const key2 = ' + tick + '$' + '{code}_display_math' + tick + ';'
  ].join('\n')
  const blockReplacement = [
    '        const macros = window.marktextMathMacros?.get?.() || {};',
    '        const key2 = ' + tick + '$' + '{code}_display_math_$' + '{JSON.stringify(macros)}' + tick + ';'
  ].join('\n')
  bundle = replaceOnce(bundle, blockPrefix, blockReplacement, 'display-math cache setup')

  const blockRender = [
    '            const html2 = katex$2.renderToString(code, {',
    '              displayMode: true',
    '            });'
  ].join('\n')
  const blockRenderReplacement = [
    '            const html2 = katex$2.renderToString(code, {',
    '              displayMode: true,',
    '              macros',
    '            });'
  ].join('\n')
  bundle = replaceOnce(bundle, blockRender, blockRenderReplacement, 'display-math KaTeX call')

  const exportRender = [
    '      return katex$2.renderToString(math2, {',
    '        displayMode',
    '      });'
  ].join('\n')
  const exportRenderReplacement = [
    '      return katex$2.renderToString(math2, {',
    '        displayMode,',
    '        macros: window.marktextMathMacros?.get?.() || {}',
    '      });'
  ].join('\n')
  bundle = replaceOnce(bundle, exportRender, exportRenderReplacement, 'export KaTeX call')

  bundle = replaceOnce(
    bundle,
    'function displayMath(h2, cursor, block2, token, outerClass) {',
    marker + '\nfunction displayMath(h2, cursor, block2, token, outerClass) {',
    'math-macro patch marker'
  )
  write(bundlePath, bundle)
  console.log('Patched renderer bundle.')
} else {
  console.log('Renderer bundle already contains the math-macro patch.')
}

const featuresMarker = '/* MARKTEXT_MATH_MACROS_FEATURES_PATCH */'
if (!bundle.includes(featuresMarker)) {
  bundle = replaceOnce(
    bundle,
    [
      '  {',
      '    name: t("preferences.categories.spelling"),',
      '    label: "spelling",',
      '    icon: reading_default,',
      '    path: "/preference/spelling"',
      '  },'
    ].join('\n'),
    [
      '  {',
      '    name: window.marktextMathMacros?.getCategoryLabel?.() || "Features",',
      '    label: "features",',
      '    icon: setting_default,',
      '    path: "/preference/features"',
      '  },',
      '  {',
      '    name: t("preferences.categories.spelling"),',
      '    label: "spelling",',
      '    icon: reading_default,',
      '    path: "/preference/spelling"',
      '  },'
    ].join('\n'),
    'features preference category'
  )

  bundle = replaceOnce(
    bundle,
    [
      '        "general",',
      '        "editor",',
      '        "markdown",',
      '        "spelling",'
    ].join('\n'),
    [
      '        "general",',
      '        "editor",',
      '        "markdown",',
      '        "features",',
      '        "spelling",'
    ].join('\n'),
    'features search route'
  )

  bundle = replaceOnce(
    bundle,
    'const parseSettingsPage = (type5) => {',
    [
      featuresMarker,
      'const Features = { render: () => null };',
      'const parseSettingsPage = (type5) => {'
    ].join('\n'),
    'features route component'
  )

  bundle = replaceOnce(
    bundle,
    [
      '      {',
      '        path: "spelling",',
      '        component: SpellChecker2,',
      '        name: "spelling"',
      '      },'
    ].join('\n'),
    [
      '      {',
      '        path: "features",',
      '        component: Features,',
      '        name: "features"',
      '      },',
      '      {',
      '        path: "spelling",',
      '        component: SpellChecker2,',
      '        name: "spelling"',
      '      },'
    ].join('\n'),
    'features route'
  )

  write(bundlePath, bundle)
  console.log('Added the Features preference category.')
} else {
  console.log('Features preference category already exists.')
}

let index = read(indexPath)
if (!index.includes('./math-macros-core.js')) {
  index = index.replace(
    '    <script type="module" crossorigin src="./assets/index-B-PE276Q.js"></script>',
    '    <script src="./math-macros-core.js"></script>\n' +
      '    <script type="module" crossorigin src="./assets/index-B-PE276Q.js"></script>'
  )
}
if (!index.includes('./math-macros-preferences.js')) {
  index = index.replace(
    '  </head>',
    '    <script defer src="./math-macros-preferences.js"></script>\n  </head>'
  )
}
write(indexPath, index)
console.log('Installed renderer helper scripts.')
