# Research Atlas 私有云入口 v0.3

云入口通过 GitHub App 登录读取私有 `RanchoTao/Research-Archive`，浏览器只接收当前已授权用户的数据。公开 Sci-Map 和 GitHub Pages 保留通用程序与空目录。这里没有研究数据、生产密钥或自动科研执行器；本地测试通过也不代表真实 OAuth、Blob 或生产部署已验收。

## 数据与授权路径

服务端使用 Express/TypeScript。登录请求产生随机 OAuth `state` 和 PKCE S256 challenge；回调校验一次性状态与 verifier。浏览器只持有不透明的 `HttpOnly; Secure; SameSite` 会话 cookie，GitHub 用户 token 与会话内容在服务端加密后存入 **Private** Vercel Blob。响应中的目录、证据、审核和会话接口均不得公开缓存。

每次受保护请求都要求当前 GitHub 数字用户 ID 在允许名单中，并用该用户 token 调用 `GET /user/installations/{installation_id}/repositories`，确认用户与 App 的权限交集包含目标私有仓库。登录成功、知道仓库名或存在 App installation 都不单独授予读取权。成员移除、App 卸载、token 撤销或 GitHub 验证失败必须拒绝读取，包括已缓存的私有目录。GitHub 官方说明了这种 [用户与 App 权限交集](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app)。

读取链为固定 Git commit 下的 `CURRENT → SHA256SUMS → 原始目录 blob`：先确定 commit，再读取该 commit 的指针、校验清单和目录；逐项 SHA-256 校验后才发布新版本。App JWT 只用于获得目标 installation 的、限定 `Research-Archive` 且 `contents:read` 的短期 token，不发送给浏览器。校验成功的目录对象、同步回执和最后已验证版本持久化在 Private Blob；失败同步不能把未校验内容替换为当前版本。

人工审核采用另一个追加写入的 Private Blob 记录层，保留审核人、输入版本、条件、时间和来源。它不修改原始研究结论，不合并争议，也不向 GitHub 回写。过往 GO/PASS 不构成新实验授权；本服务不启动 AutoResearch。

## 本地检查

在 `cloud/` 中执行：

```sh
npm ci
npm run build
npm test
npm run audit
```

`build` 只编译服务端 TypeScript。通用浏览器文件单独提供，不能把服务端 `dist/` 设置为公开静态目录。测试使用隔离的假会话、假 GitHub/Blob 与通用数据，不能需要生产 secrets。审计脚本验证公开空目录、浏览器文件和生成的 Pages 产物；`node scripts/audit-public.mjs --self-test` 额外验证检测器对非空目录、泄漏 token 与多余产物会拒绝。

在项目根目录运行旧版检查：

```sh
python -m unittest discover -s tests -v
node tests/test_search.cjs
node tests/test_private_import.cjs
```

需要调试服务时使用 `npm run dev`；如已配置隔离开发变量，用 `node --env-file=.env.local --import tsx src/server.ts` 明确加载配置。只有隔离开发配置可放进被忽略的 `.env.local`，不得把生产 token 下载为本地开发配置，也不要在终端命令、截图或日志中显示密钥。

## 注册 GitHub App

1. 在 GitHub **Settings → Developer settings → GitHub Apps → New GitHub App** 创建当前账户所有的 App；不创建有全仓库权限的 OAuth App。名称自行选择，Homepage URL 使用将要测试的 HTTPS Vercel 入口。
2. Callback URL 精确设置为 `https://<该环境入口>/api/auth/callback`。生产与预览必须分开配置入口和凭据；优先使用独立预览 App，避免随机预览域名被当作生产回调。不要添加任意回调或关闭 `state`/PKCE 校验。
3. 保留用户访问 token 到期功能：GitHub App 用户 token 通常 8 小时到期；撤销或到期后要求重新登录，不用永久 PAT 替代。到期机制见 [GitHub 用户 token 更新文档](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/refreshing-user-access-tokens)。
4. Repository permissions 只设置 **Contents: Read-only** 与必须的 **Metadata: Read-only**；其余 repository、organization、account 权限保持 No access。此版本不消费 webhook，将 Active webhook 关闭，也不申请写入权限。注册选项见 [GitHub App 注册说明](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/registering-a-github-app)。
5. 安装 App 时选择 **Only select repositories → Research-Archive**，不能选择 All repositories。记录 App ID、Client ID 和 installation 数字 ID。生成 Client secret 与 App 私钥后直接保存到该环境的服务端 Secret 配置，不提交 PEM 文件。
6. 用已授权身份从 GitHub `/user` 或 `gh api user --jq .id` 确认真实数字 ID。允许名单只填写明确获准且实际能访问该私有仓库的用户 ID；不能使用显示名、登录名或客户端传入 ID 代替服务器确认。

## Vercel 与 Private Blob

在 Vercel 项目设置中将 Root Directory 指向 `cloud`，使用实际 Express 服务端入口；不要使用 GitHub Pages 构建方式部署此服务。暂不配置 DNS 或自定义域名，使用项目 HTTPS 默认域名。

通过项目 Storage 创建 **Private** Blob store，并连接到对应环境。预览使用独立 Private store，不使用生产会话与审核存储。官方 [Private Storage 文档](https://vercel.com/docs/vercel-blob/private-storage) 要求私有读写经过认证；所有 Blob 读写均指定 `access: 'private'`。不能把 store 改成 Public 来排除错误。

在 Vercel 的环境变量设置中逐项配置下表。值均只在服务端使用，不使用 `NEXT_PUBLIC_`、`VITE_` 或浏览器注入。生产/预览 Secrets 与会话加密密钥必须分开，参见 [Vercel 环境变量配置](https://vercel.com/docs/environment-variables)。

| 变量 | 值与用途 |
| --- | --- |
| `APP_ORIGIN` | 当前环境唯一 HTTPS origin，无路径；必须对应已登记 callback |
| `GITHUB_APP_ID` | App 数字 ID |
| `GITHUB_CLIENT_ID` | App OAuth Client ID，与 App ID 不同 |
| `GITHUB_CLIENT_SECRET` | 当前环境 App OAuth secret |
| `GITHUB_INSTALLATION_ID` | 只安装目标私有仓库的 installation 数字 ID |
| `GITHUB_APP_PRIVATE_KEY` | 完整 PEM；平台按实际换行保存，不能发送到客户端 |
| `GITHUB_ALLOWED_USER_IDS` | 逗号分隔的正整数 GitHub 数字 ID；不得出现空项、用户名或非整数 |
| `SESSION_SECRET` | 32 个随机字节的 base64 编码；配置解析器会检查解码长度 |
| `BLOB_READ_WRITE_TOKEN` | 连接当前环境 Private Blob 的服务端凭据 |
| `BLOB_STORE_ID` | 仅当已锁定 SDK 与当前存储适配器实际验证了 OIDC/store ID 方式时可替代 token；不能仅配置名称就声称兼容 |

必须保留实际 `package-lock.json` 并使用 `npm ci`。Blob SDK 的 token 与 store ID/OIDC 支持以安装版本、适配器类型检查和真实私有读写为准；文档或变量存在本身不证明平台可用。

## 生产前真实验收

先对隔离预览入口完成真实测试并记录时间、commit、脱敏结果和具体限制，随后才决定生产部署。不得记录 OAuth code、cookie、token、PEM 或完整私有响应。

1. 未登录访问目录、证据、审核与导出均拒绝；公开 HTML/JS 无私有记录或密钥。
2. 允许用户完成 GitHub 跳转、回调、cookie 设置、登录后读取；校验真实仓库交集。允许名单外用户，以及允许但没有目标仓库权限的用户，都被拒绝。
3. 无效/重复 `state`、PKCE mismatch、错误 callback origin 被拒绝；过期或撤销用户 token、移除仓库授权后，旧会话不能读取私有缓存。
4. 固定 commit 的目录下载 SHA-256 通过；篡改 hash 的同步被拒绝，保留上一已验证版本并追加失败回执。GitHub 临时错误不能跳过实时用户权限检查。
5. Private Blob 的真实加密会话写读成功，服务实例重启仍能恢复已验证目录；Blob 对象匿名读取失败。Private 数据响应使用 `Cache-Control: no-store`。
6. 审核记录追加持久化，保留作者、原始来源和条件；GitHub installation 权限仍只有 Contents/Metadata read，不出现仓库写入。

当前的 CI 是代码与公开产物检查，不提供这些真实 OAuth/私有 Blob 验收结论。未验证的平台配置、凭据提供、跨机语义审核、历史覆盖缺口及无人值守执行器仍需各自记录，不能以网站能打开代替 `ARCHIVE_GATE=PASS`。

## 可用范围与扩展

登录回调和每次私有 API 请求还会复核 installation 的仓库选择及 Contents/Metadata 只读权限。扩大为全部仓库或写权限时直接拒绝访问；权限错误不进入旧快照回退。该检查与目录的 60 秒版本轮询独立。

目前在用户访问时同步，并在活跃页面每 60 秒检测版本；不依赖原电脑，也不启动后台科研任务。用户 token 最多使用 8 小时，到期重新登录，不保留 refresh token。GitHub 身份/仓库权限验证不可达时拒绝读取缓存；仅目录同步失败而授权验证成功时，返回最后已验证版本及错误代码。故障回执保存在私有存储，存储自身故障时仅能通过 API 错误观测。

服务端分页上限 40、图谱上限 80 节点、时间线响应上限 200 事件；客户端不加载完整 JSON。现阶段接受不超过 100 MB 的单个 Git blob、100,000 条来源记录，并验证十万条通用记录的索引和分页。搜索索引当前保存在函数内存中；达到文件/内存阈值前，需要将来源目录分片或导入专用全文搜索存储。这些阈值是明确的迁移边界，不代表已对十万条完整科研正文完成负载验收。

Private Blob 的成功同步回执、快照绑定和审核意见分别追加保存。独立源码分支不会自动发布生产应用；现有 Pages 工作流不变。Preview 可能另受 Vercel Deployment Protection 保护，这层保护不等于应用内 GitHub 登录验收。
