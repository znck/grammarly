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

    options.plugins.push(typescript({ tsconfig: info.tsconfig.configFile }))
    const entries = [
      'vscode-jsonrpc',
      'vscode-languageclient',
      'vscode-languageserver',
      'vscode-languageserver-protocol',
    ]

    return options.output
      .map((output) => {
        const isBrowser = output.file.includes('.browser.')
        if (!isBrowser) {
          return {
            ...options,
            output,
            plugins: [
              resolve({ exportConditions: ['node', 'import', 'require'], preferBuiltins: true }),
              ...options.plugins,
            ],
          }
        }

        const plugins = options.plugins.slice()

        if (info.packageJson.name === 'grammarly-languageserver') {
          plugins.push(wasm(output.file))
        }

        if (info.packageJson.name === 'grammarly') {
          if (Path.basename(options.input) === 'server.ts') {
            plugins.push(
              wasm(output.file),
              copy({
                targets: [
                  {
                    src: Path.resolve(
                      __dirname,
                      'packages/grammarly-languageserver/node_modules/web-tree-sitter/tree-sitter.wasm',
                    ),
                    dest: Path.dirname(output.file),
                  },
                ],
              }),
            )
          }
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
            patch(),
            resolve(),
            ...plugins,
          ],
        }
      })
      .filter(Boolean)
  },
})

function patch() {
  return {
    id: 'patch',
    resolveId(id, file) {
      if (id === 'path' && file.includes('/node_modules/minimatch/')) {
        return `${__dirname}/polyfills/minimatch-path.js`
      }

      if (['path', 'fs'].includes(id) && file.includes('/node_modules/web-tree-sitter/')) {
        return `${__dirname}/polyfills/web-tree-sitter-path.js`
      }

      if (id === 'node-fetch') {
        return `${__dirname}/polyfills/fetch.js`
      }
    },
  }
}

function wasm(file) {
  return copy({
    targets: [
      {
        src: Path.resolve(__dirname, 'tree-sitter/tree-sitter-{html,markdown}.wasm'),
        dest: Path.dirname(file),
      },
    ],
  })
}
