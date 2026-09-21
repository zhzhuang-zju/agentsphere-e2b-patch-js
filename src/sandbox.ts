import { Sandbox as OrigSandbox } from 'e2b/dist/index.mjs'

import { install } from './install.js'
import { registerTrafficAccessToken, TRAFFIC_HEADER } from './tokens.js'

install()

type SandboxCtorOpts = ConstructorParameters<typeof OrigSandbox>[0]

function attachEnvdMiddleware(sandbox: OrigSandbox): void {
  const token = sandbox.trafficAccessToken
  if (!token) {
    return
  }
  const envdApi = (
    sandbox as unknown as {
      envdApi?: { api?: { use?: (middleware: unknown) => void } }
    }
  ).envdApi
  envdApi?.api?.use?.({
    async onRequest({ request }: { request: Request }) {
      if (request.headers.has(TRAFFIC_HEADER)) {
        return request
      }
      const headers = new Headers(request.headers)
      headers.set(TRAFFIC_HEADER, token)
      return new Request(request, { headers })
    },
  })
}

export class Sandbox extends OrigSandbox {
  constructor(opts: SandboxCtorOpts) {
    registerTrafficAccessToken(opts?.sandboxId, opts?.trafficAccessToken)
    super(opts)
    attachEnvdMiddleware(this)
  }
}
