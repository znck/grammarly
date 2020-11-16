import json from '@rollup/plugin-json'
import nodeResolve from '@rollup/plugin-node-resolve'
import replace from '@rollup/plugin-replace'
import typescript from '@rollup/plugin-typescript'
import size from 'rollup-plugin-filesize'
import dts from 'rollup-plugin-dts'
import Path from 'path'

function deps(fileName) {
  return Array.from(Object.keys(require(fileName).dependencies || {}))
}

function abs(fileName) {
  return Path.resolve(__dirname, fileName)
}

/** @type {import('rollup').RollupOptions[]} */
const configs = [
  {
    input: './packages/grammarly-api/src/index.ts',
    output: {
      format: 'esm',
      file: './packages/grammarly-api/dist/index.d.ts',
    },
    plugins: [dts()],
  },
  {
    input: './packages/grammarly-language-server/src/index.ts',
    output: {
      format: 'esm',
      file: './packages/grammarly-language-server/dist/index.d.ts',
    },
    plugins: [dts()],
  },
  {
    input: './packages/grammarly-language-client/src/index.ts',
    output: {
      format: 'esm',
      file: './packages/grammarly-language-client/dist/index.d.ts',
    },
    plugins: [dts()],
  },
  {
    input: './packages/grammarly-api/src/index.ts',
    output: [
      {
        format: 'cjs',
        file: './packages/grammarly-api/dist/index.cjs.js',
        sourcemap: true,
      },
      {
        format: 'esm',
        file: './packages/grammarly-api/dist/index.esm.js',
        sourcemap: true,
      },
    ],
    plugins: [
      replace({
        values: {
          __DEV__: `process.env.NODE_ENV !== 'production'`,
        },
      }),
      nodeResolve(),
      json(),
      typescript({ tsconfig: abs('./packages/grammarly-api/tsconfig.json') }),
      size(),
    ],
    external: [...deps('./packages/grammarly-api/package.json'), 'ws', 'util'],
  },
  {
    input: './packages/grammarly-language-server/src/index.ts',
    output: [
      {
        format: 'cjs',
        file: './packages/grammarly-language-server/dist/index.cjs.js',
        sourcemap: true,
      },
      {
        format: 'esm',
        file: './packages/grammarly-language-server/dist/index.esm.js',
        sourcemap: true,
      },
    ],
    plugins: [
      replace({
        values: {
          __DEV__: `process.env.NODE_ENV !== 'production'`,
        },
      }),
      // nodeResolve(),
      json(),
      typescript({ tsconfig: abs('./packages/grammarly-language-server/tsconfig.json') }),
      size(),
    ],
    external: [...deps('./packages/grammarly-language-server/package.json'), 'crypto', 'util', 'events'],
  },
  {
    input: './packages/grammarly-language-client/src/index.ts',
    output: [
      {
        format: 'cjs',
        file: './packages/grammarly-language-client/dist/index.cjs.js',
        sourcemap: true,
      },
      {
        format: 'esm',
        file: './packages/grammarly-language-client/dist/index.esm.js',
        sourcemap: true,
      },
    ],
    plugins: [
      replace({
        values: {
          __DEV__: `process.env.NODE_ENV !== 'production'`,
        },
      }),
      // nodeResolve(),
      json(),
      typescript({ tsconfig: abs('./packages/grammarly-language-client/tsconfig.json') }),
      size(),
    ],
    external: [...deps('./packages/grammarly-language-client/package.json')],
  },
]

export default configs
