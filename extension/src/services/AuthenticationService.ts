import crypto from 'crypto'
import { injectable } from 'inversify'
import fetch from 'node-fetch'
import qs from 'querystring'
import { commands, Disposable, env, Uri, UriHandler, window } from 'vscode'
import { Registerable } from '../interfaces'
import { getKeyTar } from '../keytar'

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
    commands.executeCommand('setContext', 'grammarly:isAnonymous', true)

    return Disposable.from(
      commands.registerCommand('grammarly.login', this.execute.bind(this)),
      window.registerUriHandler(this),
    )
  }

  handleUri(uri: Uri) {
    if (uri.path === '/auth/callback') {
      const args = qs.parse(uri.query) as { response_type: string; code: string; code_challenge: string }

      if (args.response_type === 'success') {
        const handler = this.challenges.get(args.code_challenge)

        if (handler != null) {
          handler.callback(null, args.code)
        } else {
          // -- Error
        }
      } else {
        // -- Error
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
    } else {
      await getKeyTar().deletePassword(COOKIE_KEY, 'default')
    }
  }

  async login(): Promise<string> {
    const clientId = CLIENTS[env.uriScheme]
    if (clientId == null) throw new Error(`Unsupported URI scheme "${env.uriScheme}://"`)

    const secret = crypto.randomBytes(32).toString('base64')
    const challenge = crypto.createHash('sha256').update(secret).digest().toString('base64')

    await env.openExternal(
      Uri.parse(
        `https://grammarly.com/signin/app?client_id=${clientId}&redirect_to=${encodeURIComponent(
          `${env.uriScheme}://znck.grammarly/auth/callback`,
        )}&code_challenge=${encodeURIComponent(challenge)}`,
      ),
    )

    return new Promise((resolve, reject) => {
      const id = setTimeout(reject, 5 * 60 * 1000, new Error('Timeout'))
      this.challenges.set(challenge, {
        secret,
        callback: async (error, code) => {
          clearTimeout(id)
          if (error != null) return reject(error)

          try {
            const response = await fetch('https://grammarly.com/api/unified-login/code/exchange', {
              method: 'POST',
              body: JSON.stringify({
                client_id: clientId,
                code,
                code_verifier: secret,
              }),
            })

            const cookie = parseSetCookieHeaders(response.headers.raw()['set-cookie'])
            if (cookie.grauth == null) throw new Error('Cannot find "grauth" cookie')

            resolve(stringifyCookie(cookie))
          } catch (error) {
            reject(error)
          }
        },
      })
    })
  }
}
