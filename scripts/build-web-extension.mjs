// @ts-check
import esbuild from 'esbuild'
import Path from 'node:path'
import { fileURLToPath } from 'node:url'
import fetch from 'node-fetch'

const __dirname = Path.dirname(fileURLToPath(import.meta.url))

const response = await fetch('https://js.grammarly.com/grammarly-sdk')
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
