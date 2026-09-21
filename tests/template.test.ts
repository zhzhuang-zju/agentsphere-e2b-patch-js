import { afterEach, describe, expect, it, vi } from 'vitest'
import { TemplateBase as OrigTemplateBase } from 'e2b/dist/index.mjs'

import {
  install,
  registerTemplateCreateExtensions,
  uninstall,
  unregisterTemplateCreateExtensions,
} from '../src/install.js'
import { Template } from '../src/template.js'

afterEach(() => {
  vi.restoreAllMocks()
  uninstall()
})

describe('Template build patch', () => {
  it('adds create extensions to the v3 request and removes its internal header', async () => {
    install()
    const marker = registerTemplateCreateExtensions({
      arch: 'arm64',
      gatewayID: 'gateway-1',
    })

    const request = new Request('https://api.e2b.dev/v3/templates', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-agentsphere-template-build': marker!,
      },
      body: JSON.stringify({
        name: 'example',
        alias: 'native-alias',
        cpuCount: 2,
      }),
    })

    expect(await request.json()).toEqual({
      name: 'example',
      alias: 'native-alias',
      cpuCount: 2,
      arch: 'arm64',
      gatewayID: 'gateway-1',
    })
    expect(request.headers.has('x-agentsphere-template-build')).toBe(false)
    unregisterTemplateCreateExtensions(marker)
  })

  it('serializes build extensions without forwarding them as official options', async () => {
    install()
    let serialized: Record<string, unknown> | undefined
    let forwardedOptions: Record<string, unknown> | undefined

    vi.spyOn(OrigTemplateBase, 'build').mockImplementation(
      async (template, _name, options) => {
        serialized = (
          template as unknown as {
            serialize(steps: unknown[]): Record<string, unknown>
          }
        ).serialize([])
        forwardedOptions = options as Record<string, unknown>
        return {
          alias: 'example',
          name: 'example',
          tags: [],
          templateId: 'template-1',
          buildId: 'build-1',
        }
      }
    )

    const template = Template().fromImage('node:22')
    await Template.build(template, 'example', {
      arch: 'arm64',
      gatewayID: 'gateway-1',
      outboundNetwork: {
        isPrivateConnect: true,
        targetProjectId: 'project-1',
        targetVpcId: 'vpc-1',
        targetSubnetId: 'subnet-1',
        targetSecurityGroupIds: ['sg-1'],
      },
      invoke: { protocol: 'http', port: 8080 },
      agencies: { runtimeAgency: 'agency-1' },
      ping: {
        enabled: true,
        path: '/health',
        protocol: 'http',
        port: 8080,
        warmUpProbe: {
          initialDelaySeconds: 1,
          timeoutSeconds: 2,
          periodSeconds: 3,
          successThreshold: 4,
          failureThresholdSeconds: 5,
          failureThreshold: 6,
          initialDelayMilliseconds: 7,
          timeoutMilliseconds: 8,
          periodMilliseconds: 9,
        },
        livenessProbe: { failureThreshold: 3 },
      },
      observability: {
        logs: {
          enableStdLogs: true,
          ltsProjectId: 'logs-project',
          ltsGroupId: 'logs-group',
          ltsStreamId: 'logs-stream',
        },
        metrics: {
          enableSystemMetrics: true,
          aomProjectId: 'metrics-project',
          aomInstanceId: 'metrics-instance',
        },
        relabeling: { rules: [{ sourceLabels: ['service'] }] },
      },
      sessionStorageConfig: { mountDir: '/mnt/session' },
      storageConfig: {
        obsMounts: [
          {
            bucket: 'bucket-1',
            bucketPath: 'templates/data',
            mountDir: '/mnt/obs',
            readOnly: true,
          },
        ],
        sfsTurboMounts: [
          {
            sfsTurboId: 'sfs-1',
            shareRoot: '/',
            sharePath: '/templates',
            mountDir: '/mnt/sfs',
            readOnly: false,
            withSessionCredential: true,
          },
        ],
      },
    })

    expect(serialized).toMatchObject({
      outboundNetwork: {
        isPrivateConnect: true,
        targetProjectId: 'project-1',
        targetVpcId: 'vpc-1',
        targetSubnetId: 'subnet-1',
        targetSecurityGroupIds: ['sg-1'],
      },
      invoke: { protocol: 'http', port: 8080 },
      agencies: { runtimeAgency: 'agency-1' },
      ping: {
        enabled: true,
        path: '/health',
        protocol: 'http',
        port: 8080,
        warmUpProbe: {
          initialDelaySeconds: 1,
          timeoutSeconds: 2,
          periodSeconds: 3,
          successThreshold: 4,
          failureThresholdSeconds: 5,
          failureThreshold: 6,
          initialDelayMilliseconds: 7,
          timeoutMilliseconds: 8,
          periodMilliseconds: 9,
        },
        livenessProbe: { failureThreshold: 3 },
      },
      observability: {
        logs: {
          enableStdLogs: true,
          ltsProjectId: 'logs-project',
          ltsGroupId: 'logs-group',
          ltsStreamId: 'logs-stream',
        },
        metrics: {
          enableSystemMetrics: true,
          aomProjectId: 'metrics-project',
          aomInstanceId: 'metrics-instance',
        },
        relabeling: { rules: [{ sourceLabels: ['service'] }] },
      },
      sessionStorageConfig: { mountDir: '/mnt/session' },
      storageConfig: {
        obsMounts: [
          {
            bucket: 'bucket-1',
            bucketPath: 'templates/data',
            mountDir: '/mnt/obs',
            readOnly: true,
          },
        ],
        sfsTurboMounts: [
          {
            sfsTurboId: 'sfs-1',
            shareRoot: '/',
            sharePath: '/templates',
            mountDir: '/mnt/sfs',
            readOnly: false,
            withSessionCredential: true,
          },
        ],
      },
    })
    expect(forwardedOptions).not.toHaveProperty('arch')
    expect(forwardedOptions).not.toHaveProperty('gatewayID')
    expect(forwardedOptions).not.toHaveProperty('invoke')
    expect(forwardedOptions?.apiHeaders).toHaveProperty(
      'x-agentsphere-template-build'
    )
  })

  it('rejects a build without the required invoke config', async () => {
    const build = vi.spyOn(OrigTemplateBase, 'build')

    await expect(
      (Template.build as Function)(Template().fromImage('node:22'), 'example')
    ).rejects.toThrow('invoke is required')
    expect(build).not.toHaveBeenCalled()
  })

  it('leaves native alias handling to the E2B SDK', async () => {
    let forwardedOptions: Record<string, unknown> | undefined
    vi.spyOn(OrigTemplateBase, 'build').mockImplementation(
      async (_template, options) => {
        forwardedOptions = options as unknown as Record<string, unknown>
        return {
          alias: 'native-alias',
          name: 'example',
          tags: [],
          templateId: 'template-1',
          buildId: 'build-1',
        }
      }
    )

    await Template.build(Template().fromImage('node:22'), {
      alias: 'native-alias',
      arch: 'arm64',
      gatewayID: 'gateway-1',
      invoke: { port: 8080 },
    })

    expect(forwardedOptions?.alias).toBe('native-alias')
    expect(forwardedOptions).not.toHaveProperty('arch')
    expect(forwardedOptions).not.toHaveProperty('gatewayID')
    expect(forwardedOptions).not.toHaveProperty('invoke')
  })

  it('serializes a missing outbound network as null', async () => {
    let serialized: Record<string, unknown> | undefined
    vi.spyOn(OrigTemplateBase, 'build').mockImplementation(async (template) => {
      serialized = (
        template as unknown as {
          serialize(steps: unknown[]): Record<string, unknown>
        }
      ).serialize([])
      return {
        alias: 'example',
        name: 'example',
        tags: [],
        templateId: 'template-1',
        buildId: 'build-1',
      }
    })

    await Template.build(Template().fromImage('node:22'), 'example', {
      invoke: { port: 8080 },
    })

    expect(serialized?.outboundNetwork).toBeNull()
  })

  it('isolates concurrent builds using the same template instance', async () => {
    let releaseFirst!: () => void
    let markFirstEntered!: () => void
    const firstEntered = new Promise<void>((resolve) => {
      markFirstEntered = resolve
    })
    const firstBlocked = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    const ports: number[] = []

    vi.spyOn(OrigTemplateBase, 'build').mockImplementation(
      async (template) => {
        const serialized = (
          template as unknown as {
            serialize(steps: unknown[]): Record<string, unknown>
          }
        ).serialize([])
        ports.push((serialized.invoke as { port: number }).port)
        if (ports.length === 1) {
          markFirstEntered()
          await firstBlocked
        }
        return {
          alias: 'example',
          name: 'example',
          tags: [],
          templateId: 'template-1',
          buildId: 'build-1',
        }
      }
    )

    const template = Template().fromImage('node:22')
    const first = Template.build(template, 'first', { invoke: { port: 8080 } })
    await firstEntered
    const second = Template.build(template, 'second', { invoke: { port: 9090 } })
    await Promise.resolve()

    expect(ports).toEqual([8080])
    releaseFirst()
    await Promise.all([first, second])
    expect(ports).toEqual([8080, 9090])
  })
})