import base64 from 'base64url'
import crypto from 'crypto'
import { injectable } from 'inversify'
import fetch from 'node-fetch'
import qs from 'querystring'
import { commands, Disposable, env, Uri, UriHandler, window } from 'vscode'
import { Registerable } from '../interfaces'
import { getKeyTar } from '../keytar'
import { GrammarlyAuthContext } from 'unofficial-grammarly-api'

const COOKIE_KEY = 'vscode-grammarly-cookie'
const CLIENTS: Record<string, string> = {
  vscode: 'extensionVSCode',
  'vscode-insiders': 'extensionVSCodeInsiders',
}

function stringifyCookie(cookie: Record<string, string>): string {
  return Object.entries(cookie)
    .map(([key, value]) => key + '=' + value + ';')
    .join(' ')
}
function parseSetCookieHeaders(cookies: string[]): Record<string, string> {
  return cookies
    .map((x) => x.split('='))
    .reduce((obj, [key, val]) => {
      obj[key] = val.split(';')[0]

      return obj
    }, {} as Record<string, string>)
}

@injectable()
export class AuthenticationService implements Registerable, UriHandler {
  private challenges = new Map<string, { secret: string; callback: (error: null | Error, code: string) => any }>()

  register() {
    void this.getCookie().then(value => {
      commands.executeCommand('setContext', 'grammarly:isAuthenticated', value != null)
    })

    return Disposable.from(
      commands.registerCommand('grammarly.login', this.execute.bind(this)),
      commands.registerCommand('grammarly.logout', () => {
        this.setCookie(null)
        void window.showInformationMessage('Logged out of grammarly.com.')
      }),
      window.registerUriHandler(this),
    )
  }

  handleUri(uri: Uri) {
    if (uri.path === '/auth/callback') {
      const args = qs.parse(uri.query) as { code: string; code_challenge: string }
      const challenge = Array.from(this.challenges.keys())
      const handler = this.challenges.get(args.code_challenge) ?? this.challenges.get(challenge[0])

      if (handler != null) {
        handler.callback(null, args.code)
      } else {
        void window.showErrorMessage(JSON.stringify({
          challenge,
          url: uri.query
        }))
      }
    }
  }

  async execute() {
    this.setCookie(await this.login())
  }

  async getCookie(): Promise<string | null> {
    return await getKeyTar().findPassword(COOKIE_KEY)
  }

  async setCookie(cookie: string | null) {
    if (cookie != null) {
      await getKeyTar().setPassword(COOKIE_KEY, 'default', cookie)
      commands.executeCommand('setContext', 'grammarly:isAuthenticated', true)
    } else {
      await getKeyTar().deletePassword(COOKIE_KEY, 'default')
      commands.executeCommand('setContext', 'grammarly:isAuthenticated', false)
    }
  }

  async login(): Promise<string> {
    const clientId = CLIENTS[env.uriScheme]
    if (clientId == null) throw new Error(`Unsupported URI scheme "${env.uriScheme}://"`)

    const codeVerifier = base64.encode(crypto.randomBytes(96))
    const challenge = base64.encode(crypto.createHash('sha256').update(codeVerifier).digest())

    await env.openExternal(
      Uri.parse(
        `https://grammarly.com/signin/app?client_id=${clientId}&code_challenge=${challenge}`,
      ),
    )

    return new Promise((resolve, reject) => {
      const id = setTimeout(reject, 5 * 60 * 1000, new Error('Timeout'))
      this.challenges.set(challenge, {
        secret: codeVerifier,
        callback: async (error, code) => {
          clearTimeout(id)
          if (error != null) return reject(error)

          try {
            const auth = await fetch(`https://auth.grammarly.com/v3/user/oranonymous?app=${clientId}`, {
              method: 'GET',
              headers: {
                'x-client-type': clientId,
                'x-client-version': '0.0.0',
              }
            })
            const anonymousCookie = parseSetCookieHeaders(auth.headers.raw()['set-cookie'])
            const response = await fetch('https://auth.grammarly.com/v3/api/unified-login/code/exchange', {
              method: 'POST',
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'x-client-type': clientId,
                'x-client-version': '0.0.0',
                'x-csrf-token': anonymousCookie['csrf-token'],
                'x-container-Id': anonymousCookie['gnar_containerId'],
                'cookie': `grauth=${anonymousCookie['grauth']}; csrf-token=${anonymousCookie['csrf-token']}`,
              },
              body: JSON.stringify({
                client_id: clientId,
                code,
                code_verifier: codeVerifier,
              }),
            })


            const cookie = parseSetCookieHeaders(response.headers.raw()['set-cookie'] ?? [])
            if (cookie.grauth == null) throw new Error('Cannot find "grauth" cookie')
            const { user } = await response.json()

            void window.showInformationMessage(`Logged in as ${user.name}.`)
            const authInfo: GrammarlyAuthContext = {
              isAnonymous: false,
              isPremium: user.type === 'Premium' || user.free === false,
              token: stringifyCookie(cookie),
              container: cookie['gnar_containerId'],
              username: user.email
            }

            resolve(JSON.stringify(authInfo))
          } catch (error) {
            reject(error)
          }
        },
      })
    })
  }

}
