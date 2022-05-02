// @ts-check
import fetch, { Headers } from 'node-fetch'
import { execSync } from 'node:child_process'
import FS from 'node:fs'
import Path from 'node:path'
import { fileURLToPath } from 'node:url'
import semver from 'semver'

/**
 * @param {string} itemName
 */
async function findLatestVersion(itemName) {
  const response = await fetch('https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery', {
    method: 'POST',
    headers: new Headers({
      Accept: 'application/json;api-version=7.1-preview.1;excludeUrls=true',
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({
      assetTypes: null,
      filters: [
        {
          criteria: [{ filterType: 7, value: itemName }],
          direction: 2,
          pageSize: 100,
          pageNumber: 1,
          sortBy: 0,
          sortOrder: 0,
          pagingToken: null,
        },
      ],
      flags: 2151,
    }),
  })

  const body = /** @type {{results: Array<{extensions: Array<{versions: Array<{version: string}>}>}>}} */ (
    await response.json()
  )

  const extension = body.results.flatMap((result) => result.extensions).find((extension) => extension != null)

  if (extension != null) return extension.versions[0]?.version

  return undefined
}

const fileNames = ['package.json']
export function getDir() {
  const arg = process.argv[2] ?? process.cwd()
  const dir = Path.isAbsolute(arg) ? arg : Path.resolve(process.cwd(), arg)
  return dir
}

/**
 * @param {string} dir
 */
function backup(dir) {
  for (const fileName of fileNames) {
    const file = Path.resolve(dir, fileName)
    const fileBak = Path.resolve(dir, `${fileName}.bak`)

    FS.writeFileSync(fileBak, FS.readFileSync(file, 'utf-8'))
  }
}

/**
 * @param {string} dir
 */
function revert(dir) {
  for (const fileName of fileNames) {
    const file = Path.resolve(dir, fileName)
    const fileBak = Path.resolve(dir, `${fileName}.bak`)

    if (FS.existsSync(fileBak)) {
      FS.writeFileSync(file, FS.readFileSync(fileBak, 'utf-8'))
      FS.unlinkSync(fileBak)
    }
  }
}

/**
 * @param {string} current
 * @param {string} [latest]
 */
function getNextPreReleaseVersion(current, latest) {
  let target = current
  const v1 = semver.parse(current)
  const v2 = semver.parse(latest)

  if (v1 == null) return semver.inc(target, 'minor')
  if (v2 == null || latest == null) {
    return semver.inc(target, v1.minor % 2 === 0 ? 'minor' : 'patch')
  }

  if (v2.compare(v1) > 0) target = latest

  return semver.inc(target, semver.minor(target) % 2 === 0 ? 'minor' : 'patch')
}

/**
 *
 * @param {string} dir
 */
async function transform(dir) {
  const pkg = JSON.parse(FS.readFileSync(`${dir}/package.json`, 'utf-8'))
  const RELEASE_CHANNEL = /** @type {'release'|'pre-release'} */ (process.env['RELEASE_CHANNEL'] ?? 'release')

  delete pkg.dependencies
  delete pkg.devDependencies

  if (RELEASE_CHANNEL === 'pre-release') {
    pkg['pre-release'] = true
    pkg.version = getNextPreReleaseVersion(pkg.version, await findLatestVersion(`${pkg.publisher}.${pkg.name}`))
    console.debug('Setting version to', pkg.version)
  }

  const packageFile = Path.resolve(dir, 'package.json')

  FS.writeFileSync(packageFile, JSON.stringify(pkg, null, 2))
}

/**
 * @param {string} dir
 * @param {() => void} fn
 */
async function prepareExtensionForPackaging(dir, fn) {
  try {
    backup(dir)
    await transform(dir)
    fn()
  } finally {
    revert(dir)
  }
}

const rootDir = Path.resolve(Path.dirname(fileURLToPath(import.meta.url)), '..')
const extensionDir = Path.resolve(rootDir, 'extension')
const bin = Path.resolve(rootDir, 'node_modules/.bin/vsce')
prepareExtensionForPackaging(extensionDir, () => {
  const execArgs = { stdio: [0, 1, 2], cwd: extensionDir }
  const RELEASE_CHANNEL = /** @type {'release'|'pre-release'} */ (process.env['RELEASE_CHANNEL'] ?? 'release')
  const args = RELEASE_CHANNEL === 'pre-release' ? '--pre-release' : ''
  execSync(`${bin} package --no-dependencies ${args} --out grammarly.vsix`, execArgs)
})
