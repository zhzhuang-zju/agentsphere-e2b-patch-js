import {
  Template as OrigTemplate,
  TemplateBase as OrigTemplateBase,
  type BuildInfo,
  type BuildOptions as OrigBuildOptions,
  type TemplateClass,
} from 'e2b/dist/index.mjs'

import {
  registerTemplateCreateExtensions,
  unregisterTemplateCreateExtensions,
} from './install.js'

export interface AgenciesConfig {
  runtimeAgency?: string
}

export interface SandboxOutboundNetwork {
  isPrivateConnect: boolean
  targetProjectId?: string
  targetVpcId?: string
  targetSubnetId?: string
  targetSecurityGroupIds: string[]
}

export interface InvokeConfig {
  protocol?: string
  port?: number
}

export interface ProbeConfig {
  initialDelaySeconds?: number
  timeoutSeconds?: number
  periodSeconds?: number
  successThreshold?: number
  failureThresholdSeconds?: number
  failureThreshold?: number
  initialDelayMilliseconds?: number
  timeoutMilliseconds?: number
  periodMilliseconds?: number
}

export interface PingConfig {
  enabled: boolean
  path?: string
  protocol?: string
  port?: number
  warmUpProbe?: ProbeConfig
  livenessProbe?: ProbeConfig
}

export type RelabelingRule = Record<string, unknown>

export interface SandboxLogs {
  enableStdLogs?: boolean
  ltsProjectId?: string
  ltsGroupId?: string
  ltsStreamId?: string
}

export interface SandboxMetrics {
  enableSystemMetrics?: boolean
  aomProjectId?: string
  aomInstanceId?: string
}

export interface SandboxRelabeling {
  rules?: RelabelingRule[]
}

export interface ObservabilityConfig {
  logs?: SandboxLogs
  metrics?: SandboxMetrics
  relabeling?: SandboxRelabeling
}

export interface SessionStorageConfig {
  mountDir: string
}

export interface OBSMount {
  bucket: string
  bucketPath?: string
  mountDir: string
  readOnly: boolean
}

export interface SFSTurboMount {
  sfsTurboId: string
  shareRoot?: string
  sharePath?: string
  mountDir: string
  readOnly: boolean
  withSessionCredential?: boolean
}

export interface StorageConfig {
  obsMounts?: OBSMount[]
  sfsTurboMounts?: SFSTurboMount[]
}

export interface BuildOptions extends OrigBuildOptions {
  arch?: string
  gatewayID?: string
  outboundNetwork?: SandboxOutboundNetwork
  invoke: InvokeConfig
  agencies?: AgenciesConfig
  ping?: PingConfig
  observability?: ObservabilityConfig
  sessionStorageConfig?: SessionStorageConfig
  storageConfig?: StorageConfig
}

type BuildExtensions = Pick<
  BuildOptions,
  | 'invoke'
  | 'agencies'
  | 'ping'
  | 'observability'
  | 'sessionStorageConfig'
  | 'storageConfig'
> & { outboundNetwork: SandboxOutboundNetwork | null }

const EXTENSIONS = Symbol('agentsphereBuildExtensions')
const buildQueues = new WeakMap<object, Promise<void>>()

async function withTemplateLock<T>(
  template: TemplateClass,
  callback: () => Promise<T>
): Promise<T> {
  const key = template as object
  const previous = buildQueues.get(key) ?? Promise.resolve()
  let release!: () => void
  const current = new Promise<void>((resolve) => {
    release = resolve
  })
  const queued = previous.then(() => current)
  buildQueues.set(key, queued)

  await previous
  try {
    return await callback()
  } finally {
    release()
    if (buildQueues.get(key) === queued) {
      buildQueues.delete(key)
    }
  }
}

function splitBuildOptions(
  options?: BuildOptions | Omit<BuildOptions, 'alias'>
): {
  options: Omit<OrigBuildOptions, 'alias'> | undefined
  extensions: BuildExtensions
  createExtensions: { arch?: string; gatewayID?: string }
} {
  if (!options?.invoke) {
    throw new TypeError('invoke is required when building an Agentsphere template')
  }

  const {
    arch,
    gatewayID,
    outboundNetwork,
    invoke,
    agencies,
    ping,
    observability,
    sessionStorageConfig,
    storageConfig,
    ...officialOptions
  } = options

  return {
    options: officialOptions as Omit<OrigBuildOptions, 'alias'>,
    extensions: {
      outboundNetwork: outboundNetwork ?? null,
      invoke,
      agencies,
      ping,
      observability,
      sessionStorageConfig,
      storageConfig,
    },
    createExtensions: { arch, gatewayID },
  }
}

async function withBuildExtensions<T>(
  template: TemplateClass,
  options: Omit<BuildOptions, 'alias'> | undefined,
  callback: (options: Omit<OrigBuildOptions, 'alias'> | undefined) => Promise<T>
): Promise<T> {
  return withTemplateLock(template, async () => {
    const split = splitBuildOptions(options)
    const target = template as OrigTemplateBase & {
      [EXTENSIONS]?: BuildExtensions
    }
    const previous = target[EXTENSIONS]
    target[EXTENSIONS] = split.extensions

    const marker = registerTemplateCreateExtensions(split.createExtensions)
    const officialOptions = marker
      ? {
          ...split.options,
          apiHeaders: {
            ...split.options?.apiHeaders,
            'x-agentsphere-template-build': marker,
          },
        }
      : split.options

    try {
      return await callback(officialOptions)
    } finally {
      unregisterTemplateCreateExtensions(marker)
      if (previous === undefined) {
        delete target[EXTENSIONS]
      } else {
        target[EXTENSIONS] = previous
      }
    }
  })
}

export class TemplateBase extends OrigTemplateBase {
  static async build(
    template: TemplateClass,
    name: string,
    options: Omit<BuildOptions, 'alias'>
  ): Promise<BuildInfo>
  static async build(
    template: TemplateClass,
    options: BuildOptions
  ): Promise<BuildInfo>
  static async build(
    template: TemplateClass,
    nameOrOptions: string | BuildOptions,
    options?: Omit<BuildOptions, 'alias'>
  ): Promise<BuildInfo> {
    const extensionOptions =
      typeof nameOrOptions === 'string' ? options : nameOrOptions
    return withBuildExtensions(template, extensionOptions, (officialOptions) =>
      typeof nameOrOptions === 'string'
        ? super.build(template, nameOrOptions, officialOptions)
        : super.build(template, {
            ...officialOptions,
            alias: nameOrOptions.alias,
          })
    )
  }

  static async buildInBackground(
    template: TemplateClass,
    name: string,
    options: Omit<BuildOptions, 'alias'>
  ): Promise<BuildInfo>
  static async buildInBackground(
    template: TemplateClass,
    options: BuildOptions
  ): Promise<BuildInfo>
  static async buildInBackground(
    template: TemplateClass,
    nameOrOptions: string | BuildOptions,
    options?: Omit<BuildOptions, 'alias'>
  ): Promise<BuildInfo> {
    const extensionOptions =
      typeof nameOrOptions === 'string' ? options : nameOrOptions
    return withBuildExtensions(template, extensionOptions, (officialOptions) =>
      typeof nameOrOptions === 'string'
        ? super.buildInBackground(template, nameOrOptions, officialOptions)
        : super.buildInBackground(template, {
            ...officialOptions,
            alias: nameOrOptions.alias,
          })
    )
  }
}

type SerializableTemplate = {
  serialize(steps: unknown[]): Record<string, unknown>
  [EXTENSIONS]?: BuildExtensions
}

const originalSerialize = (
  OrigTemplateBase.prototype as unknown as SerializableTemplate
).serialize

Object.defineProperty(TemplateBase.prototype, 'serialize', {
  configurable: true,
  value(this: SerializableTemplate, steps: unknown[]) {
    const serialized = originalSerialize.call(this, steps)
    for (const [name, value] of Object.entries(this[EXTENSIONS] ?? {})) {
      if (value !== undefined) {
        serialized[name] = value
      }
    }
    return serialized
  },
})

type TemplateOptions = Parameters<typeof OrigTemplate>[0]
type TemplateFromImage = ReturnType<typeof OrigTemplate>

type CallableTemplate = typeof TemplateBase &
  ((options?: TemplateOptions) => TemplateFromImage)

export function callableTemplate<T extends typeof TemplateBase>(
  templateClass: T
): T & ((options?: TemplateOptions) => TemplateFromImage) {
  const boundMethods = new Map<PropertyKey, unknown>()

  return new Proxy(templateClass, {
    apply(target, _thisArg, args: [TemplateOptions?]) {
      return new target(...args)
    },
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver)
      if (property === 'prototype' || typeof value !== 'function') {
        return value
      }
      if (!boundMethods.has(property)) {
        boundMethods.set(property, value.bind(receiver))
      }
      return boundMethods.get(property)
    },
  }) as T & ((options?: TemplateOptions) => TemplateFromImage)
}

export const Template: CallableTemplate = callableTemplate(TemplateBase)