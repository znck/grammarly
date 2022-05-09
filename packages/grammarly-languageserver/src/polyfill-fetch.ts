// @ts-nocheck
if (typeof global !== 'undefined' && typeof global.fetch === 'undefined') {
  ;(async () => {
    const { default: fetch, Request, Response, Headers } = await getNodeFetch()
    global.fetch = fetch
    global.Request = Request
    global.Response = Response
    global.Headers = Headers
  })()

  function getNodeFetch(): any {
    try {
      return require('node-fetch')
    } catch {
      return import('node-fetch')
    }
  }
}
