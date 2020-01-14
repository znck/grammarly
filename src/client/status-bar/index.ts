import { getClient } from '@/client'
import { Grammarly } from '@/shared/grammarly'
import {
  ExtensionContext,
  StatusBarAlignment,
  StatusBarItem,
  TextDocument,
  ThemeColor,
  window,
  workspace,
} from 'vscode'
import { isIgnoredDocument } from '../utils'

let statusBar: StatusBarItem

export function registerStatusBar(context: ExtensionContext) {
  statusBar = window.createStatusBarItem(StatusBarAlignment.Left)

  statusBar.text = '$(globe) checking...'
  statusBar.tooltip = 'Grammarly waiting...'
  statusBar.color = new ThemeColor('statusBar.foreground')

  context.subscriptions.push(statusBar)
  context.subscriptions.push(window.onDidChangeActiveTextEditor(e => onDidOpenDocument(e && e.document)))
  context.subscriptions.push(workspace.onDidCloseTextDocument(onDidCloseDocument))

  const client = getClient()

  client.onReady().then(() =>
    client.onNotification('event:grammarly.finished', (uri: string, result: Grammarly.FinishedResponse) => {
      if (isActiveDocument(uri)) {
        const status = result.outcomeScores
        const v = (num: number) => Number.parseInt(`${num * 100}`)

        statusBar.command = 'grammarly.stats'
        statusBar.text = '$(globe) ' + result.generalScore + ' out of 100'
        statusBar.tooltip = [
          `Clarity: ${v(status.Clarity)}`,
          `Correctness: ${v(status.Correctness)}`,
          `Engagement: ${v(status.Engagement)}`,
          `Tone: ${v(status.Tone)}`,
        ].join('\n')
        statusBar.show()
      }
    })
  )

  onDidOpenDocument(window.activeTextEditor && window.activeTextEditor.document)
}

function isActiveDocument(uri: string) {
  return window.activeTextEditor && window.activeTextEditor.document.uri.toString() === uri
}

let lastDocument: TextDocument
function onDidOpenDocument(document?: TextDocument) {
  if (document) {
    lastDocument = document
    const isIgnored = isIgnoredDocument(document)

    if (!isIgnored) {
      return statusBar.show()
    }
  }

  if (
    lastDocument &&
    window.visibleTextEditors.some(editor => editor.document.uri.toString() === lastDocument.uri.toString())
  ) {
    return
  }

  statusBar.command = undefined
  return statusBar.hide()
}

function onDidCloseDocument(document: TextDocument) {
  if (lastDocument && document.uri.toString() === lastDocument.uri.toString()) {
    statusBar.command = undefined
    statusBar.hide()
  }
}
