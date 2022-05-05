// @ts-nocheck
import fetch, { Request, Response, Headers } from 'node-fetch'

if (typeof global.fetch === 'undefined') {
  global.fetch = fetch
  global.Request = Request
  global.Response = Response
  global.Headers = Headers
}
