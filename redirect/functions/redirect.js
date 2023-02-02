// @ts-check
let schemes = new Set([
  'vscode',
  'vscode-insiders',
  'vscodium',
  'gitpod-code',
  'code-oss',
])
let validQueryParams = new Set([
  'vscode-reqid',
  'vscode-scheme',
  'vscode-authority',
  'vscode-path',
  'windowId',
])

/**
 * @param {import('@netlify/functions').HandlerEvent} event
 * @param {import('@netlify/functions').HandlerContext} _context
 * @returns {Promise<import('@netlify/functions').HandlerResponse>}
 */
exports.handler = async function (event, _context) {
  const { state, code } = event.queryStringParameters
  if (state == null) throw new Error(`Missing "state" query parameter.`)
  const url = new URL(Buffer.from(state, 'base64url').toString())
  const scheme = url.protocol.slice(0, -1)
  if (
    url.origin === 'https://github.dev' &&
    url.pathname === '/extension-auth-callback'
  ) {
    validQueryParams = new Set(['state'])
  } else if (scheme === 'http' || scheme === 'https') {
    validate(
      url.searchParams.get('vscode-scheme'),
      url.searchParams.get('vscode-authority'),
      url.searchParams.get('vscode-path'),
    )
  } else {
    validate(scheme, url.host, url.pathname)
  }

  url.searchParams.set('code', code)
  url.searchParams.forEach((_, key) => {
    if (!validQueryParams.has(key)) url.searchParams.delete(key)
  })

  return getResponse(url.toString())
}

function validate(scheme, hostname, pathname) {
  if (!schemes.has(scheme)) throw new Error(`Invalid scheme: ${scheme}`)
  if (hostname !== 'znck.grammarly')
    throw new Error(`Invalid authority: ${hostname}`)
  if (pathname !== '/auth/callback')
    throw new Error(`Invalid path: ${pathname}`)
}

/**
 * @param {string} url
 * @returns {import('@netlify/functions').HandlerResponse}
 */
function getResponse(url) {
  return {
    statusCode: 302,
    headers: {
      Location: url,
      'Content-Type': 'text/html',
    },
    body: `Redirecting to <a href=${JSON.stringify(url)}>${url}</a>`,
  }
}
