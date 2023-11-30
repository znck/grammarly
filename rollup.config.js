import typescript from '@rollup/plugin-typescript'
import copy from 'rollup-plugin-copy'
import { generateRollupOptions } from '@vuedx/monorepo-tools'
import Path from 'path'

export default [
  ...generateRollupOptions({
    extend(kind, info) {
      if (kind === 'dts') return info.rollupOptions
      const options = info.rollupOptions
      options.plugins.push(typescript({ tsconfig: info.tsconfig.configFile }))

      if (info.packageJson.name === 'grammarly' && options.input.endsWith('server.ts')) {
        const file = options.output[0].file
        options.plugins.push(
          wasm(file),
          copy({
            targets: [
              {
                src: Path.resolve(
                  __dirname,
                  'packages/grammarly-languageserver/node_modules/web-tree-sitter/tree-sitter.wasm',
                ),
                dest: Path.dirname(file),
              },
            ],
          }),
        )
      }
      if (
        info.packageJson.name === 'grammarly-languageserver' ||
        info.packageJson.name === 'grammarly-richtext-encoder'
      ) {
        options.plugins.push(wasm(options.output[0].file))
      }

      return options
    },
  }),
]

function wasm(file) {
  return copy({
    targets: [
      {
        src: Path.resolve(__dirname, 'parsers/tree-sitter-{html,markdown}.wasm'),
        dest: Path.dirname(file),
      },
    ],
  })
}
