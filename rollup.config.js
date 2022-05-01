import alias from '@rollup/plugin-alias'
import typescript from '@rollup/plugin-typescript'
import { generateRollupOptions } from '@vuedx/monorepo-tools'

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
        if (!isBrowser) return { ...options, output }

        return {
          ...options,
          output,
          external: options.external.filter((id) => !entries.includes(id.replace(/\/node$/, ''))),
          plugins: [
            alias({
              entries: [
                ...entries.map((find) => ({ find: new RegExp(`^${find}(/node)?$`), replacement: `${find}/browser` })),
                { find: new RegExp('^@grammarly/sdk$'), replacement: '@grammarly/sdk/lib/index.esm.js' },
              ],
            }),
            {
              id: 'resolve',
              resolveId(id, file) {
                if (id === 'path' && file.includes('/node_modules/minimatch/'))
                  return `${__dirname}/scripts/minimatch-path.js`
                if (id === 'isomorphic-fetch') return `${__dirname}/scripts/fetch.js`
              },
            },
            ...options.plugins,
          ],
        }
      })
      .filter(Boolean)
  },
})
