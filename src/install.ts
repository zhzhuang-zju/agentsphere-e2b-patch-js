import { injectTrafficAccessToken, SANDBOX_ID_HEADER, TRAFFIC_HEADER } from './tokens.js'

const FLAG = '_agentsphere_e2b_patched'

type HeadersConstructor = typeof Headers
type FetchFn = typeof fetch

let originalHeaders: HeadersConstructor | undefined
let originalFetch: FetchFn | undefined
let origSet: typeof Headers.prototype.set | undefined
let origAppend: typeof Headers.prototype.append | undefined

function isSandboxIdHeader(name: string): boolean {
  return name.toLowerCase() === SANDBOX_ID_HEADER
}

function patchHeadersPrototype(ctor: HeadersConstructor): void {
  if ((ctor.prototype.set as { [FLAG]?: boolean })[FLAG]) {
    return
  }

  origSet = ctor.prototype.set
  origAppend = ctor.prototype.append

  ctor.prototype.set = function (name: string, value: string): void {
    origSet!.call(this, name, value)
    if (isSandboxIdHeader(name)) {
      injectTrafficAccessToken(this)
    }
  }
  ;(ctor.prototype.set as { [FLAG]?: boolean })[FLAG] = true

  ctor.prototype.append = function (name: string, value: string): void {
    if (name.toLowerCase() === TRAFFIC_HEADER && this.has(TRAFFIC_HEADER)) {
      return
    }
    origAppend!.call(this, name, value)
    if (isSandboxIdHeader(name)) {
      injectTrafficAccessToken(this)
    }
  }
  ;(ctor.prototype.append as { [FLAG]?: boolean })[FLAG] = true
}

function restoreHeadersPrototype(ctor: HeadersConstructor): void {
  if (origSet) {
    ctor.prototype.set = origSet
    origSet = undefined
  }
  if (origAppend) {
    ctor.prototype.append = origAppend
    origAppend = undefined
  }
}

function wrapFetch(orig: FetchFn): FetchFn {
  const wrapped: FetchFn = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.headers) {
      const headers = new Headers(init.headers)
      injectTrafficAccessToken(headers)
      init = { ...init, headers }
    } else if (input instanceof Request) {
      injectTrafficAccessToken(input.headers)
    }
    return orig(input as RequestInfo, init)
  }) as FetchFn
  return wrapped
}

export function install(): void {
  if (typeof Headers !== 'undefined') {
    patchHeadersPrototype(Headers)
    if (!originalHeaders) {
      originalHeaders = Headers
      class PatchedHeaders extends originalHeaders {
        constructor(init?: HeadersInit) {
          super(init)
          injectTrafficAccessToken(this)
        }
      }
      globalThis.Headers = PatchedHeaders as HeadersConstructor
    }
  }

  if (typeof fetch === 'function' && !originalFetch) {
    originalFetch = globalThis.fetch.bind(globalThis)
    globalThis.fetch = wrapFetch(originalFetch)
  }
}

export function uninstall(): void {
  if (originalHeaders) {
    restoreHeadersPrototype(originalHeaders)
    globalThis.Headers = originalHeaders
    originalHeaders = undefined
  }
  if (originalFetch) {
    globalThis.fetch = originalFetch
    originalFetch = undefined
  }
}

export { TRAFFIC_HEADER }
