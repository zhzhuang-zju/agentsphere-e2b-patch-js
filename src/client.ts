import { E2B as OrigE2B, type E2BClientOpts } from 'e2b'

import { Sandbox } from './sandbox.js'

type BoundSandbox = typeof OrigE2B.prototype.Sandbox & {
  boundOpts?: object
}

export class E2B extends OrigE2B {
  declare Sandbox: typeof Sandbox

  constructor(opts?: E2BClientOpts) {
    super(opts)
    const boundOpts = (this.Sandbox as BoundSandbox).boundOpts
    Object.defineProperty(this, 'Sandbox', {
      configurable: true,
      writable: false,
      value: class extends Sandbox {
        protected static override readonly boundOpts = boundOpts
      },
    })
  }
}
