# Implementation and update guide

## Runtime change in this working copy

The current offline working copy contains the official v0.19.1 application
bundle under `app/`. The patch is intentionally small:

1. `app/out/renderer/math-macros-core.js` parses the preference text and reads
   `localStorage['marktext.mathMacros']`.
2. `app/out/renderer/math-macros-preferences.js` adds a textarea to the normal
   Preferences page and writes that value to local storage.
3. `scripts/apply-math-macros-patch.mjs` adds those scripts to the renderer and
   changes the three KaTeX calls in the bundled renderer. It also adds the
   macro configuration to the math-render cache key, so two macro settings do
   not share stale output.

The patch does not perform a textual replacement in Markdown. It passes the
parsed object as `macros` to KaTeX only from math renderers.

## Reapplying after an upstream update

With a fresh MarkText source checkout, the clean source-level locations are:

- `packages/muya/src/inlineRenderer/renderer/inlineMath.ts`
- `packages/muya/src/block/extra/math/mathPreview.ts`
- `packages/muya/src/utils/marked/extensions/math.ts` or the desktop export
  renderer, depending on the upstream version
- `packages/muya/src/types.ts`
- `packages/desktop/src/main/preferences/schema.json`
- `packages/desktop/src/renderer/src/store/preferences.ts`
- `packages/desktop/src/renderer/src/components/editorWithTabs/editor.vue`
- `packages/desktop/src/renderer/src/prefComponents/editor/index.vue`

Apply the same idea at each KaTeX call:

```ts
const macros = parseMathMacros(muya.options.mathMacros)
katex.renderToString(math, { displayMode, macros })
```

For inline and block preview caches, include `JSON.stringify(macros)` in the
cache key. Add `mathMacros: string` to the preference schema/defaults and pass
it into the Muya options object. A small textarea preference component is
enough; no parser or Markdown lexer change is needed.

For a built v0.19.1 bundle in this working copy, run:

```powershell
node scripts/apply-math-macros-patch.mjs
node scripts/test-math-macros.mjs
```

The patch script fails if an expected anchor is missing, which makes an
upstream bundle change visible instead of silently producing a partial build.

## Rebuilding the delivered Windows package

The delivered `setup.exe` is a self-extracting 7-Zip installer. It installs
per-user into `%LOCALAPPDATA%\Programs\MarkText-math-macros` and launches the
installed `marktext.exe` with a separate `marktext-user-data` directory; it
does not require administrator permission. The separate directory prevents
the fork from sharing MarkText's single-instance lock and preferences with an
official installation.

On the first installation only, `scripts/prepare-setup-staging.mjs` generates
an installer script that copies `preferences.json`, the Chromium Local Storage
database (which contains the `latex-alias` values), and small window/recent-file
state files from `%APPDATA%\marktext`. A marker file prevents later installs
from overwriting settings already created by the personal build.

The official Windows package keeps several runtime packages in
`resources/app.asar.unpacked/node_modules`. The local `app/` tree used by the
small ASAR packer also needs their JavaScript package files, so synchronize
them before packing. For v0.19.1 this is `ced`, `font-list`, `keytar`,
`native-keymap`, and `@vscode/ripgrep-win32-x64`:

The packaging sequence is:

```powershell
node scripts/sync-runtime-dependencies.mjs
node scripts/apply-math-macros-patch.mjs
node scripts/test-math-macros.mjs
node scripts/pack-asar.mjs
node scripts/prepare-setup-staging.mjs
7z a -t7z -mx=9 dist/work/marktext-math-macros.7z dist/MarkText-math-macros/*
node scripts/build-setup.mjs
```

The generated file is
`dist/marktext-math-macros-0.19.1-setup.exe`. It is unsigned, so Windows may
show the normal SmartScreen warning for a locally built executable.
