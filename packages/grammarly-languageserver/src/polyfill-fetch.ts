// @ts-nocheck
if (typeof global.fetch === 'undefined') {
  ;(async () => {
    const { default: fetch, Request, Response, Headers } = await import('node-fetch')
    global.fetch = fetch
    global.Request = Request
    global.Response = Response
    global.Headers = Headers
  })()
}
