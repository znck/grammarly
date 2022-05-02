import alias from '@rollup/plugin-alias'
import resolve from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import { generateRollupOptions } from '@vuedx/monorepo-tools'
import Path from 'path'
import copy from 'rollup-plugin-copy'

export default generateRollupOptions({
  extend(kind, info) {
    if (kind === 'dts') return info.rollupOptions
    const options = info.rollupOptions

    options.plugins.push(resolve(), typescript({ tsconfig: info.tsconfig.configFile }))
    const entries = [
      'vscode-jsonrpc',
      'vscode-languageclient',
      'vscode-languageserver',
      'vscode-languageserver-protocol',
    ]

    return options.output
      .map((output) => {
        const isBrowser = output.file.includes('.browser.')
        if (!isBrowser)
          return {
            ...options,
            output,
            plugins: [...options.plugins],
          }

        const plugins = options.plugins.slice()

        if (
          options.input === 'grammarly/src/server.ts' ||
          info.packageJson.name === 'grammarly-languageserver-transformers'
        ) {
          plugins.push(
            copy({
              targets: [
                {
                  src: Path.resolve(
                    __dirname,
                    'packages/grammarly-languageserver-transformers/node_modules/tree-sitter-wasm-prebuilt/lib/tree-sitter-{html,markdown}.wasm',
                  ),
                  dest: Path.dirname(output.file),
                },
              ],
            }),
          )
        }
        if (info.packageJson.name === 'grammarly') {
          plugins.push({
            id: 'resolve',
            resolveId(id) {
              if (id.startsWith('node:')) return { id: id.substring(5), external: true }
            },
          })
        }

        return {
          ...options,
          output,
          external: options.external.filter((id) => !entries.includes(id.replace(/\/node$/, ''))),
          plugins: [
            alias({
              entries: [
                ...entries.map((find) => ({ find: new RegExp(`^${find}(/node)?$`), replacement: `${find}/browser` })),
              ],
            }),
            {
              id: 'resolve',
              resolveId(id, file) {
                if (id === 'path' && file.includes('/node_modules/minimatch/'))
                  return `${__dirname}/polyfills/minimatch-path.js`
                if (['path', 'fs'].includes(id) && file.includes('/node_modules/web-tree-sitter/'))
                  return `${__dirname}/polyfills/web-tree-sitter-path.js`
                if (id === 'isomorphic-fetch') return `${__dirname}/polyfills/fetch.js`
              },
            },
            ...plugins,
          ],
        }
      })
      .filter(Boolean)
  },
})
