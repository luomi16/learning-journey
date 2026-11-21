# 网页编辑服务

GitHub Pages 继续托管公开网站。这个 Node 22 服务托管登录、Markdown 编辑器、预览、校验和 GitHub 提交；不替代 Pages。只有 `GITHUB_ALLOWED_USER` 指定且有仓库写入权限的账号可以编辑现有文件。

## 本地启动

1. 在 GitHub Settings → Developer settings → OAuth Apps 创建 OAuth App。开发回调 URL 填 `http://localhost:4174/auth/callback`，主页填 `http://localhost:4174`。
2. 把根目录 `.env.example` 复制为 `.env`，填写 Client ID、Client Secret。`.env` 已被忽略，不要提交凭据。
3. 根目录执行 `npm ci`，然后 `npm run editor`，访问 `http://localhost:4174`。
4. 若要从本地网站右上角进入：`EDITOR_URL=http://localhost:4174 npm run dev`。

## 正式部署

1. 把此仓库部署到支持 Node 22、常驻进程和 HTTPS 的服务。构建命令 `npm ci`，启动命令 `node editor/server.mjs`。必须保留根目录、scripts/ 和三个内容目录的结构。端口取 `PORT`，默认 4174。
2. 创建正式环境专用的 GitHub OAuth App。主页设为编辑服务的 HTTPS 地址，回调 URL 为 `https://你的编辑服务域名/auth/callback`。
3. 在托管服务的环境变量中配置 `.env.example` 中的项目。`EDITOR_ORIGIN` 必须是编辑服务公开 HTTPS 地址（无子路径），`SITE_URL` 为公开网站地址。Client Secret 只放在托管平台的秘密环境变量中。
4. 在 GitHub 仓库 Settings → Secrets and variables → Actions → Variables 添加 `EDITOR_URL`，值为编辑服务 HTTPS 地址。重新运行完整的 Deploy learning journal 工作流。
5. 网站右上角「编辑」进入编辑器；知识页和笔记页自动选择当前文件，主页提供所有文件的选择器。未配置 `EDITOR_URL` 时按钮置灰。

当前 OAuth 权限为 `public_repo`，适用于当前公开仓库。不要直接用于私有仓库；若需要更细的授权范围，后续迁移到仅安装此仓库的 GitHub App。请使用用户授权 token，不能替换成 Actions 的 GITHUB_TOKEN，否则提交可能无法触发发布工作流。

## 保存、提交和冲突

- 内容变化时每 60 秒保存一次草稿；切换文件、页面隐藏和关闭前也尝试保存。草稿只在当前浏览器保留，不存凭据。清理浏览器数据会删除草稿。
- 登录后发现草稿会显示恢复按钮；不会自动覆盖仓库版本。存在旧版本草稿时需手动比较合并。
- 提交前展示原文和修改后的全文。服务端将所有 Markdown 放入临时目录，运行现有构建脚本验证元数据、日期、内部链接和 Paper 格式。通过后才提交。
- GitHub 文件 SHA 用于并发检测。IDE 修改了相同文件时拒绝覆盖；保留草稿，复制修改后重新加载仓库版本，手动合并再提交。
- 提交后轮询本次 commit 对应的 deploy.yml，成功显示已发布，失败保留提交并给出日志入口。约十分钟后停止自动查询，可继续通过 GitHub 链接查看。
- 会话和 OAuth 登录状态存在服务内存中，8 小时会话过期，重启后重新登录。第一版部署单实例；多实例需要共享会话存储和提交锁。
- token 只保存在服务内存，浏览器仅接收 HttpOnly 会话 cookie。编辑 API 校验同源请求和 CSRF token；只允许 content/、notes/、knowledge/ 内的已有 Markdown 文件。

## 验收

先在测试分支/测试仓库验证登录、草稿恢复、元数据报错、IDE 冲突及提交后的发布状态。当前自动化测试使用模拟 GitHub API，不会写入真实仓库。生产 OAuth 和部署流程必须在配置真实凭据后验证。
