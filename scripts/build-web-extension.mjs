// @ts-check
import esbuild from 'esbuild'
import fetch from 'node-fetch'
import FS from 'node:fs'
import Path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = Path.dirname(fileURLToPath(import.meta.url))
const {
  dependencies: { '@grammarly/sdk': sdkTargetVersion },
} = JSON.parse(FS.readFileSync(Path.resolve(__dirname, '../packages/grammarly-languageserver/package.json'), 'utf-8'))

const controller = new AbortController()
const timeout = setTimeout(() => controller.abort(), 5000)
const version = String(sdkTargetVersion).replace(/^.*?(\d+\.\d+).*?$/, (_, match) => match)

const response = await fetch('https://js.grammarly.com/grammarly-sdk@' + version, {
  signal: controller.signal,
  redirect: 'follow',
})
clearTimeout(timeout)
const contents = await response.text()

await esbuild.build({
  entryPoints: [Path.resolve(__dirname, '../extension/dist/extension/index.mjs')],
  bundle: true,
  external: ['vscode'],
  platform: 'browser',
  format: 'cjs',
  outfile: Path.resolve(__dirname, '../extension/dist/extension/index.browser.js'),
  write: true,
})

await esbuild.build({
  entryPoints: [Path.resolve(__dirname, '../extension/dist/server/index.mjs')],
  bundle: true,
  external: ['vscode'],
  platform: 'browser',
  format: 'iife',
  outfile: Path.resolve(__dirname, '../extension/dist/server/index.browser.js'),
  footer: { js: ';globalThis.window=globalThis;' + contents + '\n' },
  write: true,
  plugins: [
    {
      name: 'polyfills',
      setup(build) {
        build.onResolve({ filter: /.*/ }, (args) => {
          if ((args.path === 'path' || args.path === 'fs') && Path.basename(args.importer) === 'tree-sitter.js') {
            return { path: Path.resolve(__dirname, '../polyfills/empty.js') }
          }
        })
      },
    },
  ],
})
