# OpenTutor Windows 安装版

适用 Windows 10/11 64 位。本安装包包含当前应用、Python、Node.js 和实际使用的依赖，不需要另外安装 Docker、WSL、Git、Python 或 Node.js。需要系统自带的 .NET Framework 4.8 和 Windows PowerShell 5.1。

## 发给朋友使用

1. 双击 OpenTutor-Setup-1.2.0-win-x64.exe，选择可写的空文件夹。默认安装到当前用户的本地应用目录，不要求管理员权限。
2. 安装完成后点击“打开学习”，或双击桌面的“OpenTutor 本地学习”。程序会启动本机服务并打开浏览器。
3. 在“设置”中选择模型服务商，填写自己的 API Key；按服务需要填写模型名、接口地址，并测试连接。所有密钥初始为空。
4. 第一次使用按页面填写学习画像，然后导入文档或 GitHub 教程。在线模型需联网，并由自己的 API 账户支付用量费用。
5. 日后直接双击启动器即可。用完点击“停止并退出”释放内存；仅关闭网页不会停止服务。

安装过程不联网，也不包含大模型权重。选择本地模型时，需要另行安装相应模型服务。扫描件 OCR 等尚未完成的可选功能不因安装包而自动增加。

## 保存和备份

课程、笔记和进度位于安装目录的 native-data/data/opentutor.db；导入文件在 native-data/uploads；私有模型配置在 native-data/settings.env。启动器可创建完整备份，备份包含密钥，勿转发。

本安装包不含制作人的 API、课程、个人笔记或学习记录。安装后会创建当前电脑独有的配置。请不要移动已经使用的安装目录；更换位置要先备份并恢复数据，而不是直接移动。

同一台电脑默认只运行一份 OpenTutor；3001、8000 端口占用时，先停止其他实例。不要对外开放这两个端口。

升级请先备份、停止旧版本，再在新空目录安装。当前安装程序不会覆盖已有目录。要移除程序，先在启动器中“停止并退出”，备份需要的记录后删除安装文件夹及对应快捷方式。没有自动删除学习数据的卸载操作。

程序尚未购买代码签名证书。仅运行来源可信的安装包，可用同一发布目录提供的 SHA256SUMS.txt 核对文件是否损坏。

## 从源码制作安装包

在已配置好的 Windows 开发目录，先运行完整前端测试，再停止服务并构建独立前端：

```powershell
$env:OPENTUTOR_PACKAGE="1"
$env:NEXT_PUBLIC_API_URL="http://127.0.0.1:8000/api"
.\.runtime\node\node.exe apps/web/node_modules/next/dist/bin/next build apps/web --webpack
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/build-native-launcher.ps1
apps/api/.venv-win/Scripts/python.exe -X utf8 scripts/build-windows-package.py
```

打包需要项目已有的 .runtime/python、.runtime/node、Python 虚拟环境依赖、Node.js 对应版本的 LICENSE（scripts/windows/Node-LICENSE.txt）与前端构建。源码包不包含这些运行文件；这是维护者的构建过程，最终安装包使用者无需执行。

生成文件在 source-release/。打包器按允许列表收集运行文件，检查当前已知私有凭据，保留第三方许可证，生成逐文件校验清单；安装程序会校验附带数据的 SHA256，并拒绝覆盖非空目录。
