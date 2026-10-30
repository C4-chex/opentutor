# 上传 GitHub 前

本项目已将可再生成的运行文件与个人学习数据排除在 Git 外。清理不会代替你创建仓库或执行上传。

## 推荐方式

使用 Git 提交项目源码。`.gitignore` 会排除密钥、数据库、上传资料、备份、运行环境、依赖、编译产物和日志。提交前检查 `git status`，不要使用 `git add -f` 绕过忽略规则。

如果使用浏览器手动上传，请使用 `source-release/OpenTutor-source.zip`：先解压，再把里面 `OpenTutor/` 的源码文件上传到新仓库。不要直接把当前整个运行目录拖进 GitHub，也不要将 ZIP 本身当作源码仓库上传。

`source-release/` 自身也在忽略列表中。其中 `local-archive/` 是整理前旧副本、日志、宣传资料及旧备份的可恢复归档，可能包含私人数据。只上传干净源码 ZIP 解压后的文件，不上传整个 `source-release/`。

## 可重复检查与打包

在项目根目录使用任意可用的 Python：

```powershell
python scripts/source-bundle.py --history --zip --web
```

已配置原生环境时，也可以使用：

```powershell
apps/api/.venv-win/Scripts/python.exe -X utf8 scripts/source-bundle.py --history --zip --web
```

工具使用 Git 自身的忽略规则，检查待发布文件与示例配置，检索可达 Git 历史中是否出现当前本机配置的真实凭据；通过后生成干净源码包与本地检查报告。报告只列文件、字段与统计，不输出凭据。

这项检查不能证明世界上所有未知密钥都不存在；已有 GitHub 密钥扫描配置继续保留。若以后把真实密钥提交进历史，应撤销对应密钥并单独处理历史，不是只改 `.gitignore`。

## 只在本机保留

- `.env`、`apps/api/.env`、`native-data/settings.env`：实际模型配置。
- `native-data/`：课程、画像、进度、导入文件、运行日志。
- `local-backups/`：保留最新可恢复备份，完整 ZIP 也含私密配置。
- `.runtime/`、`apps/api/.venv-win/`、`apps/web/node_modules/`：当前启动依赖。
- `apps/web/.next/` 与 `OpenTutor.exe`：本机构建结果。

这些目录可能仍占用本地空间，但不会进入正常 Git 提交或工具生成的源码包。删除它们会需要重建环境或丢失个人数据。

## 保留的公开文件

应用源码、测试、依赖版本文件、配置模板、启动器源码、必要脚本、使用文档、许可证和上游来源均保留。新电脑安装步骤见仓库 README。

## 网页上传分批包

源码文件较多，GitHub 网页每次最多上传 100 个文件，每个文件最多 25 MiB。可使用 `--web` 额外生成 `OpenTutor-GitHub-web-upload.zip`，每批最多 90 个文件。解压后按 batch 编号逐批上传**里面**的文件及目录到同一仓库根目录，不要上传 batch 外层目录。完整步骤在压缩包的“先读我.txt”。[GitHub 官方说明](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository)。

普通完整源码包 `OpenTutor-source.zip` 仍保留，适合解压浏览或通过 GitHub Desktop 上传。

## 给使用者的安装包

Windows 安装包与源码包分别交付。安装包上传 GitHub 的 Release 附件，不要塞进源码仓库；也可直接传给朋友。它不包含个人 API、资料或数据库，安装后在设置页填写自己的 API。构建步骤和当前限制见[Windows 安装版](guides/windows-distribution.zh-CN.md)。
