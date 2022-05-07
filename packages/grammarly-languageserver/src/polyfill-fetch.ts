// @ts-nocheck
if (typeof global !== 'undefined' && typeof global.fetch === 'undefined') {
  ;(async () => {
    const { default: fetch, Request, Response, Headers } = require('node-fetch')
    global.fetch = fetch
    global.Request = Request
    global.Response = Response
    global.Headers = Headers
  })()
}
