import { afterEach, describe, expect, it } from 'vitest'

import { install, uninstall } from '../src/install.js'
import {
  _resetTokensForTests,
  injectTrafficAccessToken,
  registerTrafficAccessToken,
  TRAFFIC_HEADER,
  trafficHeaders,
} from '../src/tokens.js'

afterEach(() => {
  uninstall()
  _resetTokensForTests()
})

describe('trafficHeaders', () => {
  it('returns the envd traffic access token header', () => {
    expect(trafficHeaders({ trafficAccessToken: 'tok' })).toEqual({
      [TRAFFIC_HEADER]: 'tok',
    })
    expect(trafficHeaders({})).toEqual({})
  })
})

describe('Headers patch', () => {
  it('injects the token when E2b-Sandbox-Id is present at construction', () => {
    registerTrafficAccessToken('sbx-1', 'tok-1')
    install()
    const headers = new Headers({ 'E2b-Sandbox-Id': 'sbx-1' })
    expect(headers.get(TRAFFIC_HEADER)).toBe('tok-1')
  })

  it('injects the token when E2b-Sandbox-Id is appended later', () => {
    registerTrafficAccessToken('sbx-2', 'tok-2')
    install()
    const headers = new Headers()
    headers.append('E2b-Sandbox-Id', 'sbx-2')
    expect(headers.get(TRAFFIC_HEADER)).toBe('tok-2')
  })

  it('injects into a copied Headers used by the RPC fetch pattern', () => {
    registerTrafficAccessToken('sbx-3', 'tok-3')
    install()
    const sandboxHeaders = {
      'E2b-Sandbox-Id': 'sbx-3',
      'E2b-Sandbox-Port': '49983',
    }
    const headers = new Headers({ 'User-Agent': 'e2b-js-sdk/test' })
    new Headers(sandboxHeaders).forEach((value, key) => {
      headers.append(key, value)
    })
    expect(headers.get(TRAFFIC_HEADER)).toBe('tok-3')
  })
})

describe('injectTrafficAccessToken', () => {
  it('is a no-op without a registered token', () => {
    const headers = new Headers({ 'E2b-Sandbox-Id': 'missing' })
    injectTrafficAccessToken(headers)
    expect(headers.get(TRAFFIC_HEADER)).toBeNull()
  })
})
