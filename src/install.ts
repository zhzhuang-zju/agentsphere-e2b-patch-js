import { injectTrafficAccessToken, SANDBOX_ID_HEADER, TRAFFIC_HEADER } from './tokens.js'

const FLAG = '_agentsphere_e2b_patched'

type HeadersConstructor = typeof Headers
type RequestConstructor = typeof Request
type FetchFn = typeof fetch

let originalHeaders: HeadersConstructor | undefined
let originalRequest: RequestConstructor | undefined
let originalFetch: FetchFn | undefined
let origSet: typeof Headers.prototype.set | undefined
let origAppend: typeof Headers.prototype.append | undefined

const templateCreateExtensions = new Map<
  string,
  { arch?: string; gatewayID?: string }
>()
let nextBuildMarker = 0

export function registerTemplateCreateExtensions(extensions: {
  arch?: string
  gatewayID?: string
}): string | undefined {
  if (extensions.arch === undefined && extensions.gatewayID === undefined) {
    return undefined
  }
  const marker = `${Date.now()}-${nextBuildMarker++}`
  templateCreateExtensions.set(marker, extensions)
  return marker
}

export function unregisterTemplateCreateExtensions(marker?: string): void {
  if (marker) {
    templateCreateExtensions.delete(marker)
  }
}

function patchTemplateCreateRequest(
  input: RequestInfo | URL,
  init?: RequestInit
): RequestInit | undefined {
  if (!init?.headers || typeof init.body !== 'string') {
    return init
  }

  const url = typeof input === 'string' || input instanceof URL ? input : input.url
  const pathname = new URL(url, 'http://localhost').pathname
  if (init.method?.toUpperCase() !== 'POST' || pathname !== '/v3/templates') {
    return init
  }

  const headers = new Headers(init.headers)
  const marker = headers.get('x-agentsphere-template-build')
  const extensions = marker && templateCreateExtensions.get(marker)
  if (!extensions) {
    return init
  }

  headers.delete('x-agentsphere-template-build')
  return {
    ...init,
    headers,
    body: JSON.stringify({ ...JSON.parse(init.body), ...extensions }),
  }
}

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

  if (typeof Request !== 'undefined' && !originalRequest) {
    originalRequest = Request
    class PatchedRequest extends originalRequest {
      constructor(input: RequestInfo | URL, init?: RequestInit) {
        super(input, patchTemplateCreateRequest(input, init))
      }
    }
    globalThis.Request = PatchedRequest as RequestConstructor
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
  if (originalRequest) {
    globalThis.Request = originalRequest
    originalRequest = undefined
  }
  if (originalFetch) {
    globalThis.fetch = originalFetch
    originalFetch = undefined
  }
}

export { TRAFFIC_HEADER }
