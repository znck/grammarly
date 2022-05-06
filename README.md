[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Release](https://img.shields.io/github/release/emacs-grammarly/grammarly-language-server.svg?logo=github)](https://github.com/emacs-grammarly/grammarly-language-server/releases/latest)
[![npm](https://img.shields.io/npm/v/@emacs-grammarly/grammarly-languageserver?logo=npm&color=green)](https://www.npmjs.com/package/@emacs-grammarly/grammarly-languageserver)
[![npm-dm](https://img.shields.io/npm/dm/@emacs-grammarly/grammarly-languageserver.svg)](https://npmcharts.com/compare/@emacs-grammarly/grammarly-languageserver?minimal=true)

# Grammarly for VS Code

[![CI/CD](https://github.com/emacs-grammarly/grammarly-language-server/actions/workflows/ci.yaml/badge.svg)](https://github.com/emacs-grammarly/grammarly-language-server/actions/workflows/ci.yaml)

A language server implementation on top of Grammarly's SDK.

## Development Setup

This project uses [pnpm](https://pnpm.io).

```sh
pnpm install
pnpm run build
```

## Adding support for new language

1. Add `"onLanguage:<language name>"` to `activationEvents` in [extension/package.json](./extension/package.json)
2. Add [tree-sitter](https://tree-sitter.github.io/tree-sitter/) grammar
   1. Install tree-sitter grammar package (generally package are named as `tree-sitter-<language name>`)
   2. Add the package to the wasm build script: [scripts/build-wasm.mjs](./scripts/build-wasm.mjs)
3. Add language transformer in the directory
   1. Create `Language<LanguageName>.ts`
   2. For reference, check [`LanguageHTML.ts`](./packages/grammarly-languageserver/src/languages/LanguageHTML.ts)

## How to get help

Have a question, or want to provide feedback? Use [repository discussions](https://github.com/znck/grammarly/discussions) to ask questions, share bugs or feedback, or chat with other users.

## Older Packages

`unofficial-grammarly-api`, `unofficial-grammarly-language-client` and `unofficial-grammarly-language-server` are deprecated and archided: https://github.com/znck/grammarly/tree/v0

## Support

This extension is maintained by [Rahul Kadyan](https://github.com/znck). You can [💖 sponsor him](https://github.com/sponsors/znck) for the continued development of this extension.

<p align="center">
  <a href="https://cdn.jsdelivr.net/gh/znck/sponsors@main/sponsors.svg">
    <img src='https://cdn.jsdelivr.net/gh/znck/sponsors@main/sponsors.png'/>
  </a>
</p>

<br>
<br>
<br>
