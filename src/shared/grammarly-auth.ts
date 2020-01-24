import fetch from 'node-fetch'

import createLogger from 'debug'

const debug = createLogger('grammarly:auth')

function toCookie(params: Record<string, string>) {
  return Object.entries(params)
    .map(([key, value]) => key + '=' + value + ';')
    .join(' ')
}

export const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.117 Safari/537.36'

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
    .map(x => x.split('='))
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

  if (response.ok) {
    const cookies = response.headers.raw()['set-cookie']
    const result = {
      raw: response.headers.get('Set-Cookie')!,
      headers: cookies,
      parsed: cookieToObject(cookies),
    }

    debug('initial cookie', cookies)

    return result
  }

  debug('no initial cookie', response)

  return null
}

function generateRedirectLocation(): string {
  return Buffer.from(
    JSON.stringify({
      type: '',
      location: `https://www.grammarly.com/after_install_page?extension_install=true&utm_medium=store&utm_source=chrome`,
    })
  ).toString('base64')
}

export async function anonymous() {
  const cookie = await getInitialCookie()
  if (!cookie) return null

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
    }
  )

  if (response.ok) {
    const cookies = response.headers.raw()['set-cookie']

    debug('can continue as anonymous user')

    return {
      raw: response.headers.get('Set-Cookie')!,
      headers: cookies,
      parsed: {
        ...cookie.parsed,
        ...cookieToObject(cookies),
      },
    }
  }

  debug('anonymous login failed', response)

  return null
}

export async function authenticate(username: string, password: string): Promise<RawAuthCookie | null> {
  const cookie = await getInitialCookie()

  if (!cookie) return null

  const headers = {
    accept: 'application/json',
    'accept-language': BROWSER_HEADERS['Accept-Language'],
    'content-type': 'application/json',
    'user-agent': BROWSER_HEADERS['User-Agent'],
    'x-client-type': 'funnel',
    'x-client-version': '1.2.1082',
    'x-container-id': cookie.parsed.gnar_containerId,
    'x-csrf-token': cookie.parsed['csrf-token'],
    'sec-fetch-site': 'same-site',
    'sec-fetch-mode': 'cors',
    cookie: `gnar_containrId=${cookie.parsed.gnar_containerId}; grauth=${cookie.parsed.grauth}; csrf-token=${cookie.parsed['csrf-token']}`,
  }

  debug('authenticating as ' + username, headers)

  const response = await fetch('https://auth.grammarly.com/v3/api/login', {
    follow: 0,
    compress: true,
    method: 'POST',
    body: JSON.stringify({ email_login: { email: username, password, secureLogin: false } }),
    headers,
  })

  if (response.ok) {
    const cookies = response.headers.raw()['set-cookie']
    const result = {
      raw: response.headers.get('Set-Cookie')!,
      headers: cookies,
      parsed: {
        ...cookie.parsed,
        ...cookieToObject(cookies),
      },
    }

    debug('authenticated', result.parsed)

    return result
  }

  debug('authentication failed', response.status, response.headers)

  return null
}
