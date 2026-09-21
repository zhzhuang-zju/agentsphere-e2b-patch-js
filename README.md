# agentsphere-e2b-patch (JavaScript / TypeScript)

给官方 [E2B JS SDK](https://www.npmjs.com/package/e2b) 打补丁，目前的 patch 内容有：

- 为访问 envd（端口 **49983**）的请求自动带上 e2b-traffic-access-token header，值来自 create sandbox 或者 connect sandbox 时返回的 `traffic_access_token`。
- 为访问 envd（端口 **49983**）之外的其他数据面请求提供帮助函数，方便设置 e2b-traffic-access-token header
- 为 Template build 增加 Agentsphere 的网络、调用、探针、可观测性和存储配置字段

## 安装

说明：先直接分发 patch 文件, 后续再考虑发布到 npm。

为了方便下载，打包好的 patch 文件暂时存放在 publish 目录下。安装前请先下载 agentsphere-e2b-patch-xxx.tgz 文件到本地。

使用 npm 命令安装：

```bash
# 先安装 e2b：agentsphere-e2b-patch 只是 patch，官方 SDK 是必须的
npm install e2b
# 再安装 agentsphere 的 e2b patch，注意修改为实际版本
npm install ./agentsphere-e2b-patch-0.1.1.tgz
```

支持 `e2b >=2.30.0 <3`，建议使用 Node.js `20.18.1` 或更高版本。其中 `Sandbox` 和 `Template` 可用于全部支持版本；通过 `new E2B()` 创建 client 需要 `e2b >=2.44.0`，因为更早版本尚未提供官方 `E2B` client API。

## 使用

使用时，必须修改 Sandbox 和 E2B 的 import！必须修改 Sandbox 和 E2B 的 import！必须修改 Sandbox 和 E2B 的 import！

Sandbox 要从 agentsphere 的 patch 中 import：

```ts
import { Sandbox } from 'agentsphere-e2b-patch'

const sandbox = await Sandbox.create({
  ......,
})
await sandbox.commands.run('echo ok')
await sandbox.files.list('/')
```

如果用官方的 E2B client，同样需要修改 E2B 的 import：

```ts
import { E2B } from 'agentsphere-e2b-patch'

const client = new E2B({ apiKey: 'e2b_...', })
const sandbox = await client.Sandbox.create()
```

不要直接使用 E2B 的 import，否则使用的是没有打补丁的 E2B SDK实现，不会携带 traffic access token：

```ts
import { Sandbox } from 'e2b'
import { E2B } from 'e2b'
```

使用 Agentsphere 扩展的模板构建参数时，`Template` 必须从 patch 引入：

```ts
import { Template } from 'agentsphere-e2b-patch'

const template = Template().fromImage('node:22')

await Template.build(template, 'my-template', {
  arch: 'arm64',
  gatewayID: 'gateway-id',
  outboundNetwork: {
    isPrivateConnect: true,
    targetSecurityGroupIds: [],
  },
  invoke: {
    protocol: 'http',
    port: 8080,
  },
  ping: {
    enabled: true,
    path: '/health',
  },
})
```

`invoke` 是必填配置。`arch` 和 `gatewayID` 会加入 create template 请求；`outboundNetwork`、`invoke`、`agencies`、`ping`、`observability`、`sessionStorageConfig` 和 `storageConfig` 会加入 start build 请求。未设置 `outboundNetwork` 时会发送 `null`。`alias` 等 E2B 原生字段仍完全由原生 SDK 处理，patch 不会额外注入或改写。

通过 patch 导入的 `E2B` client，其 `client.Template` 也包含这些扩展。

## 非 envd 端口

如果不是通过 E2B SDK 访问 ENVD，比如访问 Sandbox 中启动的监听于 8080 的端口的应用进程：`sandbox.getHost(8080)` 时，agentsphere patch 不会去做全局劫持。需要用户手工添加 traffic access token 的 header，agentsphere patch 提供了帮助函数 traffic_headers() ：

```ts
import { trafficHeaders } from 'agentsphere-e2b-patch'

await fetch(`https://${sandbox.getHost(8080)}`, {
  headers: trafficHeaders(sandbox),
})
```

> 备注： E2B 官方 SDK 不会自动设置 traffic access token 的 header，同样需要用户手工设置。

## 开发

```bash
# 进入源码所在目录
cd agentsphere-e2b-patch-js

# 安装项目依赖
npm install

# 执行测试：npm test
make test

# 在 dist/ 目录下构建出 js 文件：npm run build
make build

# 清理构建产物
make clean

# 执行 clean + build 之后，打包为 publish/agentsphere-e2b-patch-<version>.tgz 文件
make tar
```


