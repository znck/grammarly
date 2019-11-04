// @ts-check
import node from 'rollup-plugin-node-resolve'
import cjs from 'rollup-plugin-commonjs'
import ts from 'rollup-plugin-typescript'

/** @type {import('rollup').RollupOptions[]} */
export default [
  {
    input: 'src/extension.ts',
    output: {
      format: 'cjs',
      file: 'out/extension.js',
      sourcemap: true,
    },
    plugins: [node({ preferBuiltins: true }), cjs(), ts({ tsconfig: 'tsconfig.build.json' })],
    external: [
      'vscode',
      // BuiltIns
      'fs',
      'child_process',
      'path',
      'net',
      'os',
      'crypto',
    ],
  },
  {
    input: 'src/server.ts',
    output: {
      format: 'cjs',
      file: 'out/server.js',
      sourcemap: true,
    },
    plugins: [node({ preferBuiltins: true }), cjs(), ts({ tsconfig: 'tsconfig.build.json' })],
    external: [
      // BuiltIns
      'fs',
      'path',
      'child_process',
      'util',
      'tty',
      'stream',
      'https',
      'http',
      'zli',
      'tls',
      'net',
      'crypto',
      'os',
      'events',
      'url',
      'zlib',
    ],
  },
]
