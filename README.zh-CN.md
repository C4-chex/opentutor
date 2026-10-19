# OpenTutor · 导入资料，循序学习

一个以个人学习为中心的 AI 学习应用。导入自己的文档、网页或 GitHub 教程后，通过引导提问、用自己的话讲解、独立练习和迁移检查，把阅读变成能够应用的知识。

**中文** · [English](README.en.md) · [上游项目](https://github.com/zijinz456/OpenTutor)

本项目基于 OpenTutor 进行定制，主要面向个人或少量朋友的本地使用。目前主要验证 **Windows 原生部署**，日常运行不需要 Docker。

## 可以做什么

| 功能 | 使用方式 |
| --- | --- |
| 导入学习资料 | 上传 PDF、Word、PowerPoint、Markdown、文本等资料，或导入网页链接 |
| 导入 GitHub 教程 | 预览指定仓库、子目录或单个文件，查看内容并选择需要的文件后导入 |
| AI 引导学习 | 围绕资料进行理解诊断和苏格拉底式追问，每次处理一个待回答的问题 |
| 费曼式理解检查 | 由学习者用自己的话解释，AI 追问遗漏或含糊的地方 |
| 练习与反馈 | 支持选择题、文字作答和编程练习；答错时指出卡点、给小提示，并允许原题重试 |
| 个性化节奏 | 首次填写学习画像，首页可调“慢一点 / 按画像调整 / 快一点” |
| 保存与续学 | 课程、画像、教学记录、已提交作答和学习进度保存在本地 |
| 教学问题反馈 | 在教学界面反馈内容、题目或判断问题，可补充自己的说明 |

编程练习包括代码阅读、结果预测、定位错误、修改程序或独立实现等形式。代码通过 AI 静态审阅，应用内不编译或执行学生提交的程序。

## 学习流程

1. **配置模型**：在设置页选择模型服务，填写自己的 API Key，并测试连接。
2. **填写画像**：说明当前基础、学习目标和偏好；之后可以在设置页修改。
3. **导入资料**：上传文件或粘贴网址。GitHub 导入先预览，再勾选需要的内容。
4. **进入 AI 引导学习**：在课程或章节入口开始，结合原始资料回答问题。
5. **解释、练习与检查**：用自己的话讲清楚，再通过独立练习与迁移任务检查理解。
6. **继续学习**：下次启动后接着已有记录学习，按需要调整速度或反馈问题。

教学循环为：**理解诊断 → 苏格拉底追问 → 费曼讲解 → 独立练习 → 迁移检查**。

“快一点”会根据画像合并适量相关步骤，不是固定倍速，也不会直接标记为掌握。看过提示后完成与独立完成分别记录；答对并解释清楚后，可以继续应用，不持续重复简单问题。速度调整从下一轮教学或新练习生效，已有题目与记录不会被改写。

## Windows 从源码运行

已验证环境：**Python 3.12、Node.js 24**。请先安装这两个运行环境与 Git，再克隆你自己的仓库或下载源码 ZIP 并解压。以下命令使用 PowerShell。

### 1. 安装依赖

在项目根目录执行；`.env.example` 是配置模板，只在首次安装时复制，已有配置请保留。

```powershell
Copy-Item .env.example apps/api/.env
py -3.12 -m venv apps/api/.venv
.\apps\api\.venv\Scripts\python.exe -m pip install -r scripts/requirements-windows.lock
npm.cmd --prefix apps/web ci
```

### 2. 配置模型

可以编辑 `apps/api/.env`，也可以启动后在应用设置页填写。以 DeepSeek 为例，修改已有的对应字段：

```dotenv
LLM_PROVIDER=deepseek
LLM_MODEL=deepseek-chat
DEEPSEEK_API_KEY=填写你自己的密钥
LLM_REQUIRED=true
```

其他服务使用各自的配置项；还可配置 OpenAI 兼容接口。模型名称与权限以你实际使用的服务为准。示例文件不含真实 API Key。

### 3. 启动后端

在项目根目录打开第一个终端：

```powershell
Set-Location apps/api
.\.venv\Scripts\python.exe -X utf8 -m uvicorn main:app --host 127.0.0.1 --port 8000
```

保留这个终端运行。

### 4. 构建并启动网页

在项目根目录打开第二个终端：

```powershell
$env:NEXT_PUBLIC_API_URL = "http://127.0.0.1:8000/api"
npm.cmd --prefix apps/web run build
npm.cmd --prefix apps/web run start -- --hostname 127.0.0.1 --port 3001
```

浏览器访问 **[http://localhost:3001](http://localhost:3001)**。

后续使用时，依赖和源码没有变化就不必重新安装或构建，重新启动后端和网页即可。修改前端源码后需要重新构建。手动启动的服务可在各自终端按 `Ctrl+C` 停止；关闭网页不会停止后台服务。

默认使用 SQLite。按示例配置启动时，个人本地使用不需要单独部署 PostgreSQL 或 Redis。

## 已配置环境的 EXE 启动器

如果这台电脑已配置项目专用的原生环境，可双击 `OpenTutor.exe` 启动并打开网页，也可使用以下入口：

| 入口 | 用途 |
| --- | --- |
| `Start-OpenTutor.cmd` | 启动服务并打开网页 |
| `Stop-OpenTutor.cmd` | 停止服务，保留学习数据 |
| `Backup-OpenTutor.cmd` | 备份原生版数据库、资料和模型配置 |

EXE 的源码为 `scripts/windows/Launcher.cs`，构建脚本为 `scripts/build-native-launcher.ps1`。**它是本地服务的启动与管理入口，需要配套的 Python、Node.js、依赖和配置**；只编译 EXE 不会自动安装运行环境。

源码仓库不包含预编译 EXE 或本机运行环境。新下载源码请先按上面的手动步骤运行；启动器所用的目录布局见[Windows 原生运行说明](docs/guides/windows-native.zh-CN.md)。

## 数据与隐私

| 内容 | 手动从源码启动 | 已配置的原生启动器 |
| --- | --- | --- |
| SQLite 数据库 | 默认 `~/.opentutor/data.db` | `native-data/data/opentutor.db` |
| 上传资料 | 默认 `apps/api/uploads/` | `native-data/uploads/` |
| 模型密钥与配置 | `apps/api/.env` | `native-data/settings.env` |

`~` 表示当前用户目录。实际位置可由配置覆盖；两种启动方式的数据不会自动互相迁移。未提交的答案草稿保存在当前浏览器，不能当作已提交的学习记录。

课程与学习记录保存在本地；使用外部模型时，相关资料、画像信息、对话和作答会按请求发送给所配置的模型服务商。API 用量与费用由用户自己的账户承担。

原生启动器的完整 ZIP 备份含模型配置，应作为私人资料保存。恢复前先停止服务并保留原数据副本，具体见[备份说明](docs/guides/windows-native.zh-CN.md)。

## 当前边界

- GitHub 导入支持公开仓库；提供文件预览和选择，不保证自动筛出的每个文件都有教学价值。
- 普通网页使用单页导入；多页文档站整站抓取尚未接入。
- 扫描件 OCR、图片中的电路图理解等能力尚未默认启用，资料可读性会影响教学质量。
- 实物电路、开发板调试和代码运行需要在应用外完成；本项目提供教学与作答审阅。
- AI 可能误判或产生错误内容，教学反馈入口用于报告问题，不代表已消除模型错误。
- 默认是本机单用户使用方式；面向公网或多人开放前，需要另行配置认证和部署环境。
- Docker、云部署与部分实验功能保留上游文件，本定制版的主要验证路径为 Windows 原生运行。

## 常见问题

**本地部署为什么还要打开浏览器？**

浏览器承载操作界面，后端和数据在本机运行。EXE 启动器会启动这些服务并打开页面。

**模型连接失败怎么办？**

在设置页检查服务商、接口地址、模型名与密钥，并测试连接。网络、代理和服务商账户状态也会影响调用；请求失败不需要重新安装整个项目。

**页面打不开或提示端口占用怎么办？**

确认前后端都在运行，并检查 8000、3001 端口是否被占用。手动启动时查看终端；启动器环境查看 `native-data/logs/`。可用 [API 健康检查](http://127.0.0.1:8000/api/health)辅助排查。

**怎样上传 GitHub？**

正常提交会按 `.gitignore` 排除密钥、学习数据库、资料、备份、依赖、日志和本机构建结果。浏览器上传请使用干净源码包解压后的文件，详见[发布说明](docs/publishing.zh-CN.md)。

## 项目结构与文档

```text
apps/api/                 FastAPI 后端、教学与评估、资料解析、本地存储
apps/web/                 Next.js / React 网页界面
scripts/                  原生启动、备份、启动器构建与源码打包工具
tests/                    后端与集成测试；前端测试另在 apps/web 中
docs/guides/              功能与运行说明
.env.example              不含真实密钥的配置模板
```

- [GitHub 资料导入](docs/guides/github-import.zh-CN.md)
- [苏格拉底与费曼教学](docs/guides/guided-learning.zh-CN.md)
- [提示式反馈与复核](docs/guides/grading.zh-CN.md)
- [学习画像与速度](docs/guides/learning-pace.zh-CN.md)
- [中文界面补充](docs/guides/localization.zh-CN.md)
- [Windows 原生运行、启动器与备份](docs/guides/windows-native.zh-CN.md)
- [准备上传 GitHub](docs/publishing.zh-CN.md)

## 来源与许可证

基于 [zijinz456/OpenTutor](https://github.com/zijinz456/OpenTutor) 修改，沿用 [MIT License](LICENSE)，保留原作者 Zijin Zhang 的版权声明。

本定制版的产品方向、界面和运行方式有所调整；当前功能与限制以本仓库说明为准。
