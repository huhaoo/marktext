# LaTeX macros: implementation and update guide

The feature is intentionally small and lives at the existing legacy Muya
rendering boundary used by MarkText `v0.19.1`:

1. `packages/muyajs/lib/utils/mathMacros.js` parses the textarea format into
   the object expected by KaTeX's `macros` option.
2. The inline renderer, display-math renderer, and HTML exporter pass that
   object to KaTeX. Their render-cache keys include the macro object, so a
   changed definition cannot reuse stale output.
3. `packages/desktop/src/renderer/src/prefComponents/features/index.vue`
   provides the dedicated **Features** preference page. The value is a normal
   persisted preference named `mathMacros`.

The parser is called only by math renderers. It never rewrites Markdown text,
ordinary prose, or code blocks.

## Applying an upstream update

Start from the new stable tag and carry the following files/changes forward:

- `packages/muyajs/lib/utils/mathMacros.js`
- the three KaTeX call sites under `packages/muyajs/lib/`
- `packages/muyajs/lib/config/index.js`
- the `mathMacros` schema/default in the desktop preferences store
- the Features route, sidebar entry, and preference component
- the locale entries under `packages/desktop/static/locales/`

Run the parser check with:

```powershell
node scripts/test-math-macros.mjs
```

Then run the normal MarkText checks/build for the selected platform. The
personal installer can keep its first-install settings-copy step separate
from the feature code, so upstream source updates remain easy to review.

## Windows first-install settings copy

The Windows NSIS installer keeps the personal build's data separate from the
official installation. `packages/desktop/build/windows/installer.nsh` copies
the official `%APPDATA%\marktext` preference file only when the personal
preference file does not already exist. On an upgrade it first backs up the
existing personal files; before a full uninstall it does the same under
`%APPDATA%\marktext-huhaoo`. A later installation restores that backup before
using the official settings as a fallback. This keeps LaTeX macros across
upgrade/uninstall/reinstall cycles while preserving the existing
portable-data detection in `packages/desktop/src/main/cli/index.ts`.
