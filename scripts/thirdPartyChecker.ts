/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-require-imports */
// @ts-nocheck
'use strict'

const path = require('path')
const fs = require('fs')
const checker = require('license-checker')

// license-checker keys packages as "<name>@<version>", and excludePackages
// matches that string exactly — name-only entries don't match. Build the
// workspace exclusions at runtime from each package's own package.json so
// version bumps stay in sync automatically. @marktext/file-icons stays
// pinned because it's a published third-party dep that license-checker
// fails to detect (MIT).
const repoRoot = path.resolve(__dirname, '..')
const workspaceExclusions = ['packages/desktop', 'packages/muyajs', 'packages/muya']
  .map((rel) => {
    const { name, version } = require(path.join(repoRoot, rel, 'package.json'))
    return `${name}@${version}`
  })
  .concat('@marktext/file-icons')
  .join(';')

const getLicenses = (rootDir, callback) => {
  // The citation feature elects CPAL for this unmodified, pinned processor.
  // About displays attribution; static/citations ships notices and full terms.
  // Keep this exception package-specific: other copyleft dependencies still fail.
  const processorVersion = '2.4.63'
  const processorRoot = path.dirname(require.resolve('citeproc/package.json', {
    paths: [path.join(repoRoot, 'packages/muyajs')]
  }))
  const processor = require(path.join(processorRoot, 'package.json'))
  const notices = path.join(repoRoot, 'packages/desktop/static/citations/LICENSES.txt')
  const terms = path.join(repoRoot, 'packages/desktop/static/citations/CPAL-1.0.txt')
  if (
    processor.version !== processorVersion ||
    processor.license !== 'CPAL-1.0 OR AGPL-1.0' ||
    !fs.existsSync(notices) || !fs.existsSync(terms)
  ) {
    callback(new Error('The citeproc CPAL exception requires the reviewed version and shipped notices.'))
    return
  }
  checker.init(
    {
      start: rootDir,
      production: true,
      development: false,
      direct: true,
      excludePackages: `${workspaceExclusions};citeproc@${processorVersion}`,
      json: true,
      onlyAllow:
        'Unlicense;WTFPL;ISC;MIT;BSD;Apache-2.0;MIT*;Apache;Apache*;BSD*;CC0-1.0;CC-BY-4.0;CC-BY-3.0'
    },
    function(err, packages) {
      if (!err && packages) {
        packages[`citeproc@${processorVersion}`] = {
          licenses: 'CPAL-1.0',
          repository: 'https://github.com/Juris-M/citeproc-js',
          licenseText: fs.readFileSync(path.join(processorRoot, 'LICENSE'), 'utf8') + '\n' + fs.readFileSync(terms, 'utf8')
        }
      }
      callback(err, packages, checker)
    }
  )
}

// Check that all production dependencies are allowed.
const validateLicenses = (rootDir) => {
  getLicenses(rootDir, (err, packages, checker) => {
    if (err) {
      console.log(`[ERROR] ${err}`)
      process.exit(1)
    }
    if (!packages || Object.keys(packages).length === 0) {
      console.log('[ERROR] No packages found — check your start path and filters.')
      process.exit(1)
    }
    console.log(checker.asSummary(packages))
  })
}

module.exports = {
  getLicenses,
  validateLicenses
}
