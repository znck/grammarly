import fetch from 'node-fetch'
import { DevLogger } from './DevLogger'

const LOGGER = __DEV__ ? new DevLogger('GrammarlyAuth') : null

function toCookie(params: Record<string, string>) {
  return Object.entries(params)
    .map(([key, value]) => key + '=' + value + ';')
    .join(' ')
}

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.149 Safari/537.36'

const BROWSER_HEADERS = {
  'User-Agent': UA,
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3',
  'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
}

function cookieToObject(cookies: string[]) {
  return cookies
    .map((x) => x.split('='))
    .reduce((obj, [key, val]) => {
      obj[key as keyof AuthCookie] = val.split(';')[0]

      return obj
    }, {} as AuthCookie)
}

export interface AuthCookie {
  gnar_containerId: string
  grauth: string
  'csrf-token': string
  funnelType: string
  browser_info: string
  redirect_location: string
}

export interface RawAuthCookie {
  raw: string
  headers: string[]
  parsed: AuthCookie
}

async function getInitialCookie(): Promise<RawAuthCookie | null> {
  const response = await fetch('https://www.grammarly.com/signin', {
    headers: {
      ...BROWSER_HEADERS,
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      Referer: 'https://www.grammarly.com/',
    },
    method: 'GET',
  })

  if (response.status < 300) {
    const cookies = response.headers.raw()['set-cookie']
    const result = {
      raw: response.headers.get('Set-Cookie')!,
      headers: cookies,
      parsed: cookieToObject(cookies),
    }

    if (__DEV__) LOGGER?.trace('Received container ID', result.parsed.gnar_containerId)

    return result
  }

  try {
    if (__DEV__)
      LOGGER?.trace(`Cannot find container ID: ${response.status} - ${response.statusText}`, await response.text())
  } catch {
    if (__DEV__) LOGGER?.trace(`Cannot find container ID: ${response.status} - ${response.statusText}`)
  }

  return null
}

function generateRedirectLocation(): string {
  return Buffer.from(
    JSON.stringify({
      type: '',
      location: `https://www.grammarly.com/`,
    }),
  ).toString('base64')
}

export interface GrammarlyAuthContext {
  isAnonymous: boolean
  token: string
  container: string
  username: string
}

export async function anonymous(): Promise<GrammarlyAuthContext> {
  if (__DEV__) LOGGER?.trace('Connecting anonymously')
  const cookie = await getInitialCookie()
  if (!cookie) {
    if (__DEV__) LOGGER?.error('Failed to get container ID')
    throw new Error('Authentication cannot be started.')
  }

  const response = await fetch(
    'https://auth.grammarly.com/v3/user/oranonymous?app=chromeExt&containerId=' + cookie.parsed.gnar_containerId,
    {
      method: 'GET',
      headers: {
        ...BROWSER_HEADERS,
        Accept: 'application/json',
        'X-Client-Type': 'extension-chrome',
        'X-Client-Version': '1.2.390-SNAPSHOT',
        'X-Container-ID': cookie.parsed.gnar_containerId,
        'x-csrf-token': cookie.parsed['csrf-token'],
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-site',
        Referer: 'https://www.grammarly.com/signin',
        Origin: 'https://www.grammarly.com',
        cookie: toCookie({
          gnar_containerId: cookie.parsed.gnar_containerId,
          redirect_location: generateRedirectLocation(),
          firefox_freemium: 'true',
          funnelType: 'free',
          browser_info: cookie.parsed.browser_info,
        }),
      },
    },
  )

  if (response.ok) {
    const cookies = response.headers.raw()['set-cookie']

    try {
      const data = await response.json()
      if (__DEV__) LOGGER?.info('Authentication successful: ' + data.id)

      return {
        isAnonymous: true,
        token: toCookie({
          ...cookie.parsed,
          ...cookieToObject(cookies),
        }),
        container: cookie.parsed.gnar_containerId,
        username: 'anonymous',
      }
    } catch {}
  }

  try {
    if (__DEV__)
      LOGGER?.error(`anonymous connection failed: ${response.status} - ${response.statusText}`, await response.text())
  } catch {
    if (__DEV__) LOGGER?.error(`anonymous connection failed: ${response.status} - ${response.statusText}`)
  }

  throw new Error(response.statusText)
}

export async function authenticate(username: string, password: string): Promise<GrammarlyAuthContext> {
  if (__DEV__) LOGGER?.trace('Connecting as ' + username)

  const cookie = await getInitialCookie()

  if (!cookie) {
    if (__DEV__) LOGGER?.error('Failed to get container ID')
    throw new Error('Authentication cannot be started.')
  }

  const headers = {
    accept: 'application/json',
    'accept-language': BROWSER_HEADERS['Accept-Language'],
    'content-type': 'application/json',
    'user-agent': BROWSER_HEADERS['User-Agent'],
    'x-client-type': 'funnel',
    'x-client-version': '1.2.2026',
    'x-container-id': cookie.parsed.gnar_containerId,
    'x-csrf-token': cookie.parsed['csrf-token'],
    'sec-fetch-site': 'same-site',
    'sec-fetch-mode': 'cors',
    cookie: `gnar_containrId=${cookie.parsed.gnar_containerId}; grauth=${cookie.parsed.grauth}; csrf-token=${cookie.parsed['csrf-token']}`,
  }

  const response = await fetch('https://auth.grammarly.com/v3/api/login', {
    follow: 0,
    compress: true,
    method: 'POST',
    body: JSON.stringify({
      email_login: { email: username, password, secureLogin: false },
    }),
    headers,
  })

  if (response.ok) {
    const cookies = response.headers.raw()['set-cookie']

    try {
      const data = await response.json()
      if (__DEV__) LOGGER?.info('Authentication successful:', data)
    } catch {}

    return {
      isAnonymous: false,
      token: toCookie({
        ...cookie.parsed,
        ...cookieToObject(cookies),
      }),
      container: cookie.parsed.gnar_containerId,
      username,
    }
  }

  try {
    const contents = await response.text()
    if (__DEV__) LOGGER?.error(`anonymous connection failed: ${response.status} - ${response.statusText}`, contents)

    const result = JSON.parse(contents)

    if (result.error === 'SHOW_CAPTCHA') {
      const error = new Error('Authentication requires captcha input.')

      // @ts-ignore
      error.code = result.error

      throw error
    }
  } catch {
    if (__DEV__) LOGGER?.error(`anonymous connection failed: ${response.status} - ${response.statusText}`)
  }

  const error = new Error(response.statusText)

  // @ts-ignore
  error.code = result.error

  throw error
}
