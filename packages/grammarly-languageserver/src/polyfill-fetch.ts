// @ts-nocheck
if (typeof global !== 'undefined' && typeof global.fetch === 'undefined') {
  ;(async () => {
    const { default: fetch, Request, Response, Headers } = await getNodeFetch()
    global.fetch = fetch
    global.Request = Request
    global.Response = Response
    global.Headers = Headers
  })()

  async function getNodeFetch(): any {
    try {
      return await import('node-fetch')
    } catch {
      return require('node-fetch')
    }
  }
}
