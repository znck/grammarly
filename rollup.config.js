// @ts-check
import node from 'rollup-plugin-node-resolve'
import cjs from 'rollup-plugin-commonjs'
import ts from 'rollup-plugin-typescript'
import json from '@rollup/plugin-json'

/** @type {import('rollup').RollupOptions[]} */
export default [
  {
    input: 'src/extension.ts',
    output: {
      format: 'cjs',
      file: 'out/extension.js',
      sourcemap: true,
    },
    plugins: [
      node({ preferBuiltins: true }),
      cjs(),
      ts({ tsconfig: 'tsconfig.build.json' }),
    ],
    external: [
      'vscode',
      'keytar',
      // BuiltIns
      'child_process',
      'crypto',
      'events',
      'fs',
      'http',
      'https',
      'net',
      'os',
      'path',
      'stream',
      'tls',
      'tty',
      'url',
      'util',
      'zlib',
    ],
  },
  {
    input: 'src/server/index.ts',
    output: {
      format: 'cjs',
      file: 'out/server.js',
      sourcemap: true,
    },
    plugins: [
      node({ preferBuiltins: true }),
      cjs(),
      ts({ tsconfig: 'tsconfig.build.json' }),
      json(),
    ],
    external: [
      // BuiltIns
      'child_process',
      'crypto',
      'events',
      'fs',
      'http',
      'https',
      'net',
      'os',
      'path',
      'stream',
      'tls',
      'tty',
      'url',
      'util',
      'zli',
      'zlib',
    ],
  },
]
