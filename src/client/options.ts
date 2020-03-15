import { LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient'

export function generateDocumentSelectors(languages: string[]) {
  return [
    ...languages.map(language => ({ scheme: 'file', language })),
    ...languages.map(language => ({ scheme: 'untitled', language })),
  ]
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

export const LANGUAGES = ['plaintext', 'markdown', 'mdx', 'asciidoc', 'latex', 'restructuredtext', 'git-commit', 'git-rebase']
export function getLanguageClientOptions(): LanguageClientOptions {
  return {
    documentSelector: generateDocumentSelectors(LANGUAGES),
    synchronize: {
      configurationSection: 'grammarly',
    },
  }
}
