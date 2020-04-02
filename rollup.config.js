// @ts-check
import node from '@rollup/plugin-node-resolve';
import cjs from '@rollup/plugin-commonjs';
import ts from 'rollup-plugin-typescript';
import json from '@rollup/plugin-json';

function onwarn(message) {
  if (
    /node_modules\/inversify\/lib\/syntax\/binding_on_syntax\.js/.test(message)
  )
    return;
  console.error(message);
}

/** @type {import('rollup').RollupOptions[]} */
export default [
  {
    onwarn,
    input: 'src/extension.ts',
    output: {
      format: 'cjs',
      file: 'out/extension.js',
      sourcemap: true,
    },
    plugins: [node(), cjs(), ts()],
    external: [
      'vscode',
      'keytar',
      // 'vscode-languageserver',
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
    onwarn,
    input: 'src/server/index.ts',
    output: {
      format: 'cjs',
      file: 'out/server.js',
      sourcemap: true,
    },
    plugins: [
      node(),
      cjs({
        namedExports: {
          'vscode-languageserver': [
            'DiagnosticSeverity',
            'Disposable',
            'Connection',
            'TextDocumentSyncKind',
            'ServerCapabilities',
            'DiagnosticTag',
            'CodeActionKind',
          ],
        },
      }),
      ts(),
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
];
