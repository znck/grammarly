import alias from '@rollup/plugin-alias'
import typescript from '@rollup/plugin-typescript'
import { generateRollupOptions } from '@vuedx/monorepo-tools'
import copy from 'rollup-plugin-copy'
import Path from 'path'

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
        if (!isBrowser)
          return {
            ...options,
            output,
            plugins: [...options.plugins],
          }

        const plugins = options.plugins.slice()

        if (
          info.packageJson.name === 'grammarly' ||
          info.packageJson.name === 'grammarly-language-server-transformers'
        ) {
          plugins.push(
            copy({
              targets: [
                {
                  src: Path.resolve(
                    __dirname,
                    'packages/grammarly-language-server-transformers/node_modules/tree-sitter-wasm-prebuilt/lib/tree-sitter-{html,markdown}.wasm',
                  ),
                  dest: Path.dirname(output.file),
                },
              ],
            }),
          )
        }

        return {
          ...options,
          output,
          external: options.external.filter((id) => !entries.includes(id.replace(/\/node$/, ''))),
          plugins: [
            alias({
              entries: [
                ...entries.map((find) => ({ find: new RegExp(`^${find}(/node)?$`), replacement: `${find}/browser` })),
                { find: new RegExp('^@grammarly/sdk$'), replacement: '@grammarly/sdk/lib/index.esm.js' },
                {
                  find: new RegExp('^grammarly-language-server-transformers$'),
                  replacement: 'grammarly-language-server-transformers/dist/index.browser.js',
                },
              ],
            }),
            {
              id: 'resolve',
              resolveId(id, file) {
                if (id === 'path' && file.includes('/node_modules/minimatch/'))
                  return `${__dirname}/scripts/minimatch-path.js`
                if (['path', 'fs'].includes(id) && file.includes('/node_modules/web-tree-sitter/'))
                  return `${__dirname}/scripts/web-tree-sitter-path.js`
                if (id === 'isomorphic-fetch') return `${__dirname}/scripts/fetch.js`
              },
            },
            ...plugins,
          ],
        }
      })
      .filter(Boolean)
  },
})
