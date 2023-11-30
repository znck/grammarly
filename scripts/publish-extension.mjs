// @ts-check
import { execSync } from 'node:child_process'
import * as Path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = Path.resolve(Path.dirname(fileURLToPath(import.meta.url)), '..')
const extensionDir = Path.resolve(rootDir, 'extension')
const bin = Path.resolve(rootDir, 'node_modules/.bin/vsce')
const execArgs = { stdio: [0, 1, 2], cwd: extensionDir }
const RELEASE_CHANNEL = /** @type {'release'|'pre-release'} */ (process.env['RELEASE_CHANNEL'] ?? 'release')
const VSCODE_MARKETPLACE_TOKEN = process.env.VSCODE_MARKETPLACE_TOKEN
const OVSX_REGISTRY_TOKEN = process.env.OVSX_REGISTRY_TOKEN
const args = RELEASE_CHANNEL === 'pre-release' ? '--pre-release' : ''
execSync(`${bin} publish -p "${VSCODE_MARKETPLACE_TOKEN}" ${args} --packagePath grammarly.vsix`, execArgs)
execSync(`pnpx ovsx publish -p "${OVSX_REGISTRY_TOKEN}" --packagePath grammarly.vsix`, execArgs) // Does not support pre-release arg yet.
