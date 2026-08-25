export const TRAFFIC_HEADER = 'e2b-traffic-access-token'
export const SANDBOX_ID_HEADER = 'e2b-sandbox-id'

const tokens = new Map<string, string>()

export function registerTrafficAccessToken(
  sandboxId: string | undefined,
  token: string | undefined
): void {
  if (!sandboxId || !token) {
    return
  }
  tokens.set(sandboxId, token)
}

export function unregisterTrafficAccessToken(sandboxId: string | undefined): void {
  if (sandboxId) {
    tokens.delete(sandboxId)
  }
}

export function tokenForSandboxId(sandboxId: string | null | undefined): string | undefined {
  if (!sandboxId) {
    return undefined
  }
  return tokens.get(sandboxId)
}

export function injectTrafficAccessToken(headers: Headers): void {
  const sandboxId = headers.get(SANDBOX_ID_HEADER)
  const token = tokenForSandboxId(sandboxId)
  if (!token || headers.has(TRAFFIC_HEADER)) {
    return
  }
  headers.set(TRAFFIC_HEADER, token)
}

export function trafficHeaders(sandbox: {
  trafficAccessToken?: string
}): Record<string, string> {
  const token = sandbox.trafficAccessToken
  if (!token) {
    return {}
  }
  return { [TRAFFIC_HEADER]: token }
}

/** @internal */
export function _resetTokensForTests(): void {
  tokens.clear()
}
