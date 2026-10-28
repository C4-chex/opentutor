# 当前定制版源码说明

## 产品定位

本项目基于 OpenTutor 定制，面向个人 Windows 本地学习。将文档、网页和 GitHub 教程导入为课程，先讲基础，再通过解释、提问、练习与迁移任务检查理解。数据本地保存，在线教学使用学习者自己的模型 API。

## 已实现的主要功能

- 支持 PDF、Word、PPT、Markdown、文本及网页导入；公开 GitHub 仓库、目录和文件先预览，再选择需要的材料。
- 首次填写学习基础、目标和偏好，设置页可修改；首页调整速度，由画像和任务要求影响教学深度。
- 基础讲解、完整示例、理解检查、苏格拉底追问、费曼讲解、独立练习和迁移检查；AI 补充内容带标记。
- 文字、选择与编程题审阅；答错先指出问题并给提示，参考答案要明确点击查看；查看提示或答案后的完成情况不直接算独立掌握。
- 学习页面优先展示教学，原始材料、子章节、学习详情和补充练习可折叠；章节总结单独呈现。
- 笔记支持选中文字、代码摘录和个人批注、整章编辑、草稿恢复、本地自动保存、导出 Markdown 与手动 Obsidian 同步。
- 小型随问助手，支持课程上下文、选中文字提问、回答加入笔记、本地保存对话；使用自己的 API。
- 本地 SQLite 保存课程、教学对话、进度、画像和反馈；教学内容和判题均有反馈入口。
- 原生 EXE 启动、托盘、停止服务、备份和日志。Windows 安装版内置运行环境，首次安装不自动加入示例课。

## 代码结构

| 路径 | 职责 |
| --- | --- |
| apps/api/ | FastAPI 后端与 SQLite 模型 |
| apps/api/services/agent/guided_learning.py | 引导教学与阶段流程 |
| apps/api/services/grading_sessions.py、answer_reveal.py | 作答记录、判定与查看答案后的独立性记录 |
| apps/api/services/ingestion/ | 文件与 GitHub 学习材料导入 |
| apps/api/services/classroom_notes.py、obsidian_notes.py | 章节笔记和 Obsidian 同步 |
| apps/web/src/ | Next.js 网页、中文界面、教学、练习、笔记和随问助手 |
| scripts/native-control.ps1 | 原生服务管理 |
| scripts/native-init.py | 首次安装生成独立空白配置 |
| scripts/windows/Launcher.cs、Setup.cs | 启动器和安装器源码 |
| scripts/build-windows-package.py | 运行环境与安装包构建 |
| scripts/source-bundle.py | 隐私检查、源码 ZIP 和网页上传分批包 |
| tests/ | 后端与原生运行回归检查；前端检查在 apps/web/src 中 |

## 两种交付

源码包包含核心源码、依赖版本、脚本、测试、许可证和文档。没有 Git 历史、API、个人数据库、导入文件、日志、备份、运行环境或 node_modules。源码使用者按 README 安装依赖；普通使用者使用 Windows 安装包。

Windows 安装包包含可运行程序和必要依赖，约 115 MB；不包含制作者的数据和密钥。安装后打开设置配置 API，填写自己的学习画像。安装版使用说明见 windows-distribution.zh-CN.md。

## 当前边界

- AI 内容和判断仍可能出错，不能保证教学和评分绝对正确。
- 代码由 AI 静态审阅，应用不编译或执行学习者提交的程序。
- 不内置大模型权重；API 服务需要网络、权限和账户余额。
- 没有默认开启扫描件 OCR、整站递归抓取；GitHub 材料质量需要使用者在预览时确认。
- 知识图谱已移除；共同依赖的掌握度、复习和先修数据保留。
- 当前安装包面向 Windows 10/11 64 位、本机单用户，不能直接公开暴露为多用户网站。
- 安装器不覆盖非空目录，升级需要先备份后安装新目录；没有自动删除数据的卸载流程。
- 已在本机独立新目录测试安装和启动，但尚未覆盖各种全新 Windows 电脑的兼容性测试。

更多说明见仓库 README、Windows 原生说明和安装版说明。
