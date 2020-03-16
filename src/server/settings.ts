import { DEFAULT_SETTINGS, GrammarlySettings } from '@/settings'
import { AuthParams } from '@/shared/socket'
import minimatch from 'minimatch'
import { Connection, DidChangeConfigurationParams } from 'vscode-languageserver'
import { env } from './env'
import { getCredentials } from '@/shared/credentialsStore'
import debug from 'debug'

const globalSettings = { ...DEFAULT_SETTINGS }
const documentSettings = new Map<string, Promise<GrammarlySettings>>()
let connection: Connection

export async function getAuthParams(): Promise<AuthParams|undefined> {
  try {
    return await getCredentials()
  }
  catch(err) {
    debug('grammarly:server:settings')(err)
    return undefined
  }
}

export function setSettingsConnection(conn: Connection) {
  connection = conn
}

export function removeDocumentSetting(resource: string) {
  documentSettings.delete(resource)
}

export async function isIgnoredDocument(resource: string) {
  const settings = await getDocumentSettings(resource)

  return settings.ignore.some(pattern => minimatch(resource, pattern))
}

export function getSettings() {
  return globalSettings
}

export async function getDocumentSettings(resource: string): Promise<GrammarlySettings> {
  if (!env.hasConfigurationCapability) {
    return globalSettings
  }

  let result = documentSettings.get(resource)

  if (!result) {
    result = connection.workspace
      .getConfiguration({
        scopeUri: resource,
        section: 'grammarly',
      })
      .then(result => result || globalSettings) as Promise<GrammarlySettings>

    documentSettings.set(resource, result)
  }

  return result
}

export function onDidChangeConfiguration(change: DidChangeConfigurationParams) {
  if (env.hasConfigurationCapability) {
    documentSettings.clear()
  } else {
    Object.assign(globalSettings, change.settings.grammarly)
  }
}

export async function refreshGlobalConfiguration() {
  const result = await connection.workspace.getConfiguration('grammarly')

  Object.assign(globalSettings, result)
}
