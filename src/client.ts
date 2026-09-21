import * as E2BSDK from 'e2b/dist/index.mjs'
import type { ConnectionOpts } from 'e2b/dist/index.mjs'

import { Sandbox } from './sandbox.js'
import { callableTemplate, Template, TemplateBase } from './template.js'

type E2BClientOpts = Omit<ConnectionOpts, 'signal'>
type E2BClientInstance = {
  readonly Sandbox: typeof Sandbox
  readonly Template: typeof Template
}
type E2BClientConstructor = new (opts?: E2BClientOpts) => E2BClientInstance

const OrigE2B =
  (E2BSDK as unknown as { E2B?: E2BClientConstructor }).E2B ??
  (class {
    constructor() {
      throw new Error('E2B client requires e2b >=2.44.0')
    }
  } as E2BClientConstructor)

type BoundSandbox = E2BClientInstance['Sandbox'] & {
  boundOpts?: object
}

type BoundTemplate = E2BClientInstance['Template'] & {
  boundOpts?: object
}

export class E2B extends OrigE2B {
  declare Sandbox: typeof Sandbox
  declare Template: typeof Template

  constructor(opts?: E2BClientOpts) {
    super(opts)
    const sandboxBoundOpts = (this.Sandbox as BoundSandbox).boundOpts
    const templateBoundOpts = (this.Template as BoundTemplate).boundOpts
    Object.defineProperty(this, 'Sandbox', {
      configurable: true,
      writable: false,
      value: class extends Sandbox {
        protected static override readonly boundOpts = sandboxBoundOpts
      },
    })
    Object.defineProperty(this, 'Template', {
      configurable: true,
      writable: false,
      value: callableTemplate(
        class extends TemplateBase {
          protected static override readonly boundOpts = templateBoundOpts
        }
      ),
    })
  }
}
