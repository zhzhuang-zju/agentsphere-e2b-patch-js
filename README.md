# agentsphere-e2b-patch (JavaScript / TypeScript)

给官方 [E2B JS SDK](https://www.npmjs.com/package/e2b) 打补丁，目前的 patch 内容有：

- 让访问 envd（端口 **49983**）的请求自动带上 create sandbox 返回的 `traffic_access_token`。

## 安装

先分发 patch 文件, 后续再考虑发布到 npm。

为了方便下载，打包好的 patch 文件暂时存放在 publish 目录下。安装前请先下载 agentsphere-e2b-patch-xxx.tgz 文件到本地。

使用 npm 命令安装：

```bash
# 先安装 e2b：agentsphere-e2b-patch 只是 patch，官方 SDK 是必须的
npm install e2b
# 在安装 agentsphere 的 e2b patch, 注意修改为实际版本
npm install ./agentsphere-e2b-patch-0.1.0.tgz
```

## 使用

使用时，必须修改 Sandbox 和 E2B 的 import！必须修改 Sandbox 和 E2B 的 import！必须修改 Sandbox 和 E2B 的 import！

Sandbox 要从 agentsphere 的 patch 中 import ：

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

`Volume` / `Template` 等其它 API 仍可从 `e2b` 引入，这些管理面 API 不需要携带 traffic access token。

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


