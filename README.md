# dsh-workspace-download

在 [DeepSeek Harness](https://github.com/deepseek-ai) Web 的会话标题栏加一个下载按钮，把当前会话工作区里的文件存到浏览器自己的下载目录。

对话框顶部「最近出现」列出本会话刚写入、编辑或交付的文件，可直接勾选；下面仍可浏览整个工作区。下载规则按选择内容决定：

| 选择 | 产物 |
| --- | --- |
| 一个文件 | 直接是该文件本身，例如 `slipstream-hpca2027-arxiv2611.14776.pdf`，MIME 按扩展名给出 |
| 同一目录的多个文件 | `目录名.zip`，包内平铺文件名，不会被套上工作区里的中间层级 |
| 跨目录 / 整个工作区 | zip，保留能区分彼此的相对路径 |

文件字节由浏览器通过 `workspaceFiles` 读取。Host 单次读取窗口上限是 2 MiB，所以插件在整份读取被拒绝时按偏移分段读、再拼成 `Uint8Array`；单文件、单次总量和文件个数由插件自己的上限约束（32 MiB / 64 MiB / 400 个），不是 Host 的默认整文件上限。压缩包在浏览器内存里拼装，不经过 Host 落盘。

上传方向相反：产物进浏览器自己的下载目录，不会写回 DSH 工作区。

入口有两处：

- 会话标题栏的下载图标（`conversation.session.header.utilities`）：对话框里浏览整个工作区、勾选最近文件。
- 右侧栏文件预览的文档工具栏（`sidebar.right.tab.document.actions`）：一键保存当前打开的这个文件。

仓库布局和 [dsh-surfer](https://github.com/wz108578656/dsh-surfer) 一样：根目录只放仓库脚本，可安装的 bundle 在 `plugin/`。

## 安装

在 Harness 里用 `plugin_manager` 的 `install_bundle`，target 指向本仓库的 `plugin` 目录；或在已经登录的 profile 上：

```bash
dsh plugin --profile web add /absolute/path/to/dsh-workspace-download/plugin
```

安装后刷新一次 Web 页面，让 `client.js` 进入页面。之后会话标题栏会出现下载图标。

自检（静态检查随仓库发布的文件）：

```bash
node scripts/selftest.mjs
```

## 行为

- 浏览走 `workspaceFiles/list`，读取走 `workspaceFiles/readBytes`，判断文件/目录走 `workspaceFiles/stat`。只覆盖当前会话工作区，工作区外的路径会被 Host 拒绝。
- 默认跳过 `node_modules`、`.git`、`.cache`、`dist`、`target`、`__pycache__` 等大目录；勾选「包含 node_modules / .git 等大目录」才递归进去。递归深度上限 24 层。
- 下载按钮有两个：「下载选中项」和「下载整个工作区」。
- 右侧栏打开文件预览时，文档工具栏里也有一个下载按钮，直接保存当前预览的这个文件（不经过对话框）：预览已经把文件解析成 Host 路径，插件拿这个路径走同一套读取和保存逻辑，超过 32 MiB 时按钮旁边给出原因。

## 限制

- 单个文件超过 32 MiB、单次总量超过 64 MiB 或超过 400 个文件时会被跳过，底部逐条写明原因（文件名、实际大小、上限），不会只说一句「打包失败」。
- 读取失败的条目单独列出 Host 返回的错误文本。
- 超大工作区（几万个文件）会让浏览器在打包时明显变慢：压缩包是在页面内存里拼出来的。
- 不读工作区以外的路径，也不调用本机任何打包命令。

## 许可

本仓库为 MIT。
