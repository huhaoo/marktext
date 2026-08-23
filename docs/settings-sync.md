# Settings sync

The personal build provides manual settings sync through a GitHub Gist.

## Use

1. Open **Preferences > Sync**.
2. Enter a GitHub Gist ID or URL. Leave it empty on the first upload to create a new private Gist.
3. Enter a GitHub token with Gist write permission and click **Save**.
4. Click **Upload** or **Download** when needed.

The token is stored in the operating system credential store. It is not written to
`preferences.json`, `settingsSync.json`, or the Gist. GitHub's [Gist REST API documentation](https://docs.github.com/en/rest/gists/gists) describes the required authentication and permissions.

## Synchronized data

The Gist contains one JSON file named `marktext-settings.json` with these sections:

- `preferences`: MarkText preference values, including LaTeX macros.
- `dataCenter`: image paths, relative-image settings, uploader data, and image history.
- `keybindings`: custom keyboard shortcuts.

Because `dataCenter` contains local paths and image/upload history, review the
contents and access level of the Gist before sharing it. A private Gist is created
by default. Downloading first writes a backup under the local
`settings-sync-backups` directory. Matching values are then applied to the current
installation; unknown values are ignored so a bundle from a newer build does not
add unsupported settings. Restart MarkText if a downloaded custom shortcut is not
active immediately.

## Bundle format

The top-level `formatVersion` is `1`. Future changes should add a new format version
and preserve the current parser for existing files. The implementation is split
between the main-process Gist service and the small portable bundle parser, so
updating the upstream MarkText code does not require carrying changes through the
entire settings system.

The lightweight bundle check can be run with:

```bash
pnpm exec tsx scripts/test-settings-sync.mjs
```
