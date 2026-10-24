# OpenTutor · Learn from Your Own Materials

A personal learning application that turns imported documents, webpages and GitHub tutorials into guided questions, explanations in your own words, independent practice and transfer checks.

[中文](README.md) · **English** · [Upstream](https://github.com/zijinz456/OpenTutor)

This is a customized fork of OpenTutor for local personal use. **Windows native deployment** is the main validated setup; Docker is not required for everyday use.

## Features

- Import PDF, Word, PowerPoint, Markdown, text and webpages.
- Preview a public GitHub repository, directory or file, then select which files to import.
- Read foundations, complete worked examples and pitfalls before choosing to begin understanding checks and Socratic questions. Existing sessions can review foundations and return to the same question. AI-supplemented prerequisites are labeled.
- Explain concepts in your own words through a Feynman-style exchange.
- Practice with multiple-choice, written and coding tasks. Mistakes receive a small hint, with retries on the original question.
- Set your background, goals and preferences at first launch, and adjust them in settings.
- Choose a slower, profile-based or faster learning pace on the home page.
- Open a global quick-question window using your configured model/API, quote selected lesson text, save answers into classroom notes and keep recent conversations locally. The original course agent remains in a separate tab.
- Write classroom notes alongside a lesson, capture teaching points or selected text, autosave locally and export Markdown. AI organization produces a preview and appends only after confirmation. Connect a local Obsidian vault in Settings, explicitly export saved chapter notes, open them in Obsidian, or preview and import external edits. Conflicts block overwrites; previous versions are kept locally. No Obsidian plugin is required.
- Keep courses, profiles, teaching history, submitted answers and progress locally.
- Report teaching, question or grading problems from the learning interface.

The learning cycle is **foundations and worked examples → understanding check → Socratic questioning → Feynman explanation → independent practice → transfer check**. Assisted completion and independent completion are recorded separately. Pace depends on the learner profile and observed answers; it is not a fixed speed multiplier. Changes apply to subsequent teaching turns or newly generated practice.

Coding tasks can involve reading, predicting output, finding bugs, modifying code or implementing a solution. Submitted code receives static AI review; the application does not compile or execute it. Hardware experiments and program execution take place outside the app.

## Run from source on Windows

Validated runtimes: **Python 3.12 and Node.js 24**. Install these and Git, then clone your own repository or extract the source archive. Commands below use PowerShell.

### 1. Install dependencies

From the project root, copy the template only for a new installation. Preserve an existing configuration.

```powershell
Copy-Item .env.example apps/api/.env
py -3.12 -m venv apps/api/.venv
.\apps\api\.venv\Scripts\python.exe -m pip install -r scripts/requirements-windows.lock
npm.cmd --prefix apps/web ci
```

### 2. Configure a model

Edit the corresponding fields in `apps/api/.env`, or configure a provider in the app's settings after startup. For example:

```dotenv
LLM_PROVIDER=deepseek
LLM_MODEL=deepseek-chat
DEEPSEEK_API_KEY=replace-with-your-own-key
LLM_REQUIRED=true
```

Other providers use their own fields. OpenAI-compatible endpoints can also be configured. Model availability depends on your provider and account. The template contains no real API key.

### 3. Start the API

In a terminal at the project root:

```powershell
Set-Location apps/api
.\.venv\Scripts\python.exe -X utf8 -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Keep this terminal running.

### 4. Build and start the web interface

In a second terminal at the project root:

```powershell
$env:NEXT_PUBLIC_API_URL = "http://127.0.0.1:8000/api"
npm.cmd --prefix apps/web run build
npm.cmd --prefix apps/web run start -- --hostname 127.0.0.1 --port 3001
```

Open **[http://localhost:3001](http://localhost:3001)**. Configure your model, complete the learner profile, import material and enter guided learning from a course or chapter.

Subsequent runs only require starting the API and web interface unless dependencies or source files change. Rebuild after changing frontend source. Stop manually started services with `Ctrl+C` in their terminals; closing the browser leaves services running.

The default personal configuration uses SQLite and does not require a separate PostgreSQL or Redis server.

## Existing native-launcher setup

A computer with the project-specific native environment already configured can use `OpenTutor.exe`, `Start-OpenTutor.cmd`, `Stop-OpenTutor.cmd` and `Backup-OpenTutor.cmd`.

Launcher source: `scripts/windows/Launcher.cs`. Build script: `scripts/build-native-launcher.ps1`. **The launcher requires the matching runtimes, dependencies and configuration. Building the EXE does not install them.** The generated EXE and local runtime are excluded from the source repository. Fresh clones should use the manual setup above.

See the [Windows native guide](docs/guides/windows-native.zh-CN.md) for its required layout and backups. Detailed feature guides are currently in Chinese.

## Data and privacy

| Item | Manual source setup | Configured native launcher |
| --- | --- | --- |
| SQLite database | Default `~/.opentutor/data.db` | `native-data/data/opentutor.db` |
| Uploaded files | Default `apps/api/uploads/` | `native-data/uploads/` |
| Model configuration | `apps/api/.env` | `native-data/settings.env` |

Paths can be overridden. These setups do not automatically migrate data between each other. Unsubmitted answer drafts belong to the current browser and are separate from submitted learning records.

Records are stored locally. When an external model is used, relevant material, profile information, conversations and answers are sent to the configured provider as part of requests. API usage and fees belong to the user's account. Complete native backup ZIPs include model configuration and should remain private.

## Current limitations

- GitHub import supports public repositories with file preview and selection. Suggested files are not guaranteed to have teaching value.
- Normal webpage import handles individual pages; whole documentation-site crawling is not integrated.
- Scanned-document OCR and circuit-diagram understanding are not enabled by default. Source readability affects teaching quality.
- AI can produce incorrect teaching or grading. The feedback entry helps report issues; it does not eliminate model errors.
- The default is a local single-user setup. Public or multi-user access needs separate authentication and deployment work.
- Upstream Docker, cloud deployment and experimental files are retained; Windows native execution is this fork's main validated path.

## Troubleshooting

If a page does not open, check that both services are running and ports 8000 and 3001 are available. Inspect terminal output for manual startup, or `native-data/logs/` for the launcher setup. The [API health endpoint](http://127.0.0.1:8000/api/health) can help diagnose backend availability.

For model failures, check the provider, endpoint, model name, credentials, network and account status in settings. Reinstalling the project is unnecessary for a failed model request.

## Source layout and documentation

- `apps/api/`: FastAPI backend, teaching, assessment, ingestion and local storage.
- `apps/web/`: Next.js / React interface and frontend tests.
- `scripts/`: Native startup, backups, launcher build and source export tools.
- `tests/`: Backend and integration tests.
- `docs/guides/`: Feature and runtime documentation.
- `.env.example`: Configuration template without real credentials.

Guides: [Classroom notes](docs/guides/classroom-notes.zh-CN.md), [GitHub import](docs/guides/github-import.zh-CN.md), [guided learning](docs/guides/guided-learning.zh-CN.md), [hint-first feedback](docs/guides/grading.zh-CN.md), [learner profile and pace](docs/guides/learning-pace.zh-CN.md), [Chinese localization](docs/guides/localization.zh-CN.md), [Windows launcher and backups](docs/guides/windows-native.zh-CN.md).

For GitHub uploads, follow the [publishing guide](docs/publishing.zh-CN.md). Git ignore rules exclude credentials, databases, uploads, backups, dependencies, logs and local build output. Browser uploads should use files extracted from the clean source bundle.

## Attribution and license

Based on [zijinz456/OpenTutor](https://github.com/zijinz456/OpenTutor), under the [MIT License](LICENSE). Original copyright notices for Zijin Zhang are preserved. Features, interface and deployment differ from upstream; this repository documents the customized version.
