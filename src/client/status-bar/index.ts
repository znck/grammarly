import { getClient, getGrammarlyClient } from '@/client'
import { onCustomEventFromServer } from '@/shared/events'
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

  client.onReady().then(() => {
    onCustomEventFromServer(client, Grammarly.Action.FEEDBACK, uri => {
      if (isActiveDocument(uri)) {
        update(uri)
      }
    })

    onCustomEventFromServer(client, Grammarly.Action.FINISHED, uri => {
      if (isActiveDocument(uri)) {
        update(uri)
      }
    })
  })

  onDidOpenDocument(window.activeTextEditor && window.activeTextEditor.document)
}

function setTooltip(status: {
  Clarity: number
  Correctness: number
  Engagement: number
  GeneralScore: number
  Tone: number
}) {
  const v = (num: number) => Number.parseInt(`${num * 100}`)
  statusBar.tooltip = [
    `Clarity: ${v(status.Clarity)}`,
    `Correctness: ${v(status.Correctness)}`,
    `Engagement: ${v(status.Engagement)}`,
    `Tone: ${v(status.Tone)}`,
  ].join('\n')
}

function isActiveDocument(uri: string) {
  return window.activeTextEditor && window.activeTextEditor.document.uri.toString() === uri
}

async function update(activeDocumentURI: string) {
  const summary = await getGrammarlyClient().getSummary(activeDocumentURI)
  statusBar.text = '$(globe) ' + summary.overall + ' out of 100'

  setTooltip(summary.scores)
  statusBar.show()
}

let lastDocument: TextDocument
async function onDidOpenDocument(document?: TextDocument) {
  if (document) {
    lastDocument = document
    const isIgnored = isIgnoredDocument(document)

    if (!isIgnored) {
      statusBar.command = 'grammarly.stats'
      statusBar.text = '$(globe) checking...'
      statusBar.tooltip = 'Grammarly waiting...'
      statusBar.show()

      return update(document.uri.toString())
    }
  }

  if (isVisibleDocument(lastDocument)) {
    return
  }

  statusBar.command = undefined
  return statusBar.hide()
}

function isVisibleDocument(document: TextDocument) {
  return !!document && window.visibleTextEditors.some(editor => areDocumentsEqual(editor.document, document))
}

function areDocumentsEqual(doc1: TextDocument, doc2: TextDocument): unknown {
  return doc1.uri.toString() === doc2.uri.toString()
}

function onDidCloseDocument(document: TextDocument) {
  if (lastDocument && document.uri.toString() === lastDocument.uri.toString()) {
    statusBar.command = undefined
    statusBar.hide()
  }
}
