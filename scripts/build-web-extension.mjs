// @ts-check
import esbuild from 'esbuild'
import Path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = Path.dirname(fileURLToPath(import.meta.url))

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
