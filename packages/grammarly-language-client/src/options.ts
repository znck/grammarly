import { LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient'

const supportedSchemes = ['file', 'untitled', 'vue', 'gist']

export function generateDocumentSelectors(languages: string[]): LanguageClientOptions['documentSelector'] {
  return languages.map((language) => supportedSchemes.map((scheme) => ({ language, scheme }))).flat(3)
}

export function getLanguageServerOptions(module: string): ServerOptions {
  return {
    run: {
      module,
      transport: TransportKind.ipc,
    },
    debug: {
      module,
      transport: TransportKind.ipc,
      options: {
        execArgv: ['--nolazy', '--inspect=6009'],
      },
    },
  }
}

export const LANGUAGES = [
  'asciidoc',
  'git-commit',
  'git-rebase',
  'json',
  'latex',
  'markdown',
  'rmd',
  'mdx',
  'plaintext',
  'restructuredtext',
]

export function getLanguageClientOptions(): LanguageClientOptions {
  return {
    documentSelector: generateDocumentSelectors(LANGUAGES),
    synchronize: {
      configurationSection: 'grammarly',
    },
  }
}
