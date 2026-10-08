# Power Agents

Power Agents is a local workspace for coordinating a small team of AI agents on text and document tasks. You choose the participants and a leader, review the leader's plan, then follow the work through task execution, synthesis, and an independent review. The interface uses a pixel-art team scene to show real run and task state.

This is a **single-user prototype**. The server runs on your computer, listens only on `127.0.0.1`, and stores runs in a local SQLite database. It is not configured for public hosting.

## What works today

- Teams of 2–5 participants using Codex CLI, Claude Code, Gemini Antigravity CLI, OpenAI API, or Anthropic API connections.
- A plan approval checkpoint before assigned tasks run, including feedback and replanning.
- Dependent tasks, participant questions, result synthesis, independent review, and Markdown downloads.
- A demo mode that exercises the same workflow without calling a model.
- Optional Telegram alerts when a plan needs approval or a reviewed run finishes. Approval stays in the local app.
- Optional macOS login startup through a user LaunchAgent.

## Quick start

Requires **Node.js 24+** and npm. CLI providers require their respective tools installed and signed in on this computer; they are optional for demo mode.

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:4317**. To try the workflow without provider credentials, create a team and enable **Демо без запросов к моделям** before selecting **Составить план**.

The server uses port `4317` by default. Set `PORT` in `.env` to use another port. Only one server should run from a project directory at a time because SQLite holds an exclusive lock.

## Configure connections

The app discovers installed CLIs at startup. Sign in using each CLI's normal login flow before starting the server. A discovered CLI or listed model does not guarantee that your account can use it; the first live call verifies access.

| Connection | Setup |
| --- | --- |
| Codex CLI | Install and sign in to `codex`. |
| Claude Code | Install and sign in to `claude`. |
| Gemini | Install and sign in to Antigravity CLI (`agy`). |
| OpenAI API | Set `OPENAI_API_KEY`. API usage is billed separately. |
| Anthropic API | Set `ANTHROPIC_API_KEY`. API usage is billed separately. |

For optional API keys, Telegram, or a custom port, copy the example file and edit the local copy:

```sh
cp .env.example .env
```

`npm run dev` and `npm start` load `.env` automatically. The file is ignored by Git. Keep tokens on the server; do not put them in browser code or commit them. Restart the server after changing credentials.

### Telegram alerts

Create a bot with BotFather, set `TELEGRAM_BOT_TOKEN` in `.env`, and restart the server. In the app's connection settings, generate a one-use pairing link and send the bot **Start** from a private chat. The bot can notify that a plan is ready for approval or that a run has completed review. Messages omit task text and artifacts. Pending alerts are saved in SQLite and retried when the app runs again; Telegram cannot approve a plan or open this loopback-only app on your phone.

## Use the workspace

1. Describe the goal, expected result, and constraints.
2. Choose 2–5 participants, connections, a leader, and models. CLI participants may use their provider default; API participants must select a model.
3. Create a plan, review roles and dependencies, then approve it or request changes.
4. Follow tasks and participant messages. The leader combines the outputs and another participant reviews the result.
5. Download the accepted result as Markdown.

The city scene reflects current run state: team members are represented by provider sprites and outstanding tasks by numbered villains. The scene is a visualization of the workflow, not an agent-controlled game.

## Production mode and macOS autostart

For a built client:

```sh
npm run build
npm start
```

On macOS, you can start the built server at login. Stop a manually started server first, then run:

```sh
npm run build
npm run service:install
```

Use `npm run service:status` to inspect the service, `npm run service:stop` and `npm run service:start` around manual development, `npm run service:restart` after changes, or `npm run service:uninstall` to remove autostart. Rebuild before restarting after client changes; restart after `.env` changes. Logs are in `.power-agents/logs/`. The LaunchAgent runs only while you are logged in and the Mac is awake. See the [prototype guide](docs/prototype.md) for the full service procedure.

## Data and current limits

- Runs, events, and Telegram delivery state live in `.power-agents/state.sqlite`; per-run workspaces live in `.power-agents/workspaces/`. These paths are ignored by Git. Task text and model responses are stored locally without encryption.
- One team runs at a time, with up to three concurrent provider calls. After a restart, interrupted runs pause for manual continuation; an unfinished provider call may be repeated.
- Provider API calls or CLI subscriptions may incur costs. Demo mode does not call models.
- The prototype produces text and Markdown. General MCP tools, attachments, editing external repositories, and a monetary budget are not implemented.
- The local bootstrap session and CSRF protection are designed for loopback use. Do not expose this server directly to the internet.

## Development and documentation

```sh
npm test
npm run test:coverage
npm run typecheck
npm run build
```

Tests use mocked providers and do not spend model quota. HTTP tests need permission to bind a local loopback port.

Start with the [detailed prototype guide](docs/prototype.md) for behavior and operational details, then the [project wiki](wiki/index.md) for module and flow maps. The [platform design](docs/superpowers/specs/2026-10-07-agent-team-platform-design.md) describes broader intent; some of its features remain planned.
