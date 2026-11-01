# Telegram Mini App: shared Codex backend route

Date: 2026-10-31
Status: promising replacement transport; protocol proof passed, actual Desktop integration not yet verified.

## Finding

The failed capability gate applied to the existing Desktop follower IPC socket. It was too narrow to treat that failure as the end of the integration investigation. Codex's documented App Server protocol provides the missing project/chat operations and caller-bound steering. The installed binary supports these operations.

Telegram Mini Apps can provide the approved phone interface. The proposed replacement connection is:

1. Telegram Mini App and bot use the existing paired-user authorization design.
2. The hosted relay forwards narrow operations to the Mac connector, with no transcript persistence.
3. The connector and Desktop connect to **one shared App Server process** through a private Unix socket.
4. That process uses the existing Codex home, project catalog, conversations, Desktop startup settings, and runtime environment.

Sharing storage alone is not enough: a second process cannot safely assume ownership of a turn currently running inside Desktop's existing process. Actual Desktop startup must use the shared backend before live mutation parity can be claimed.

## Verified today

Research used Chrome browser MCP to inspect Telegram's official Mini App documentation and the official Codex App Server documentation. Installed CLI help and generated version-specific schemas were checked as well.

- Bundled binary: `/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex`, version `0.166.0-alpha.5.1`.
- A temporary stdio App Server using the existing Codex home successfully handled `initialize`, `project/list {limit:1}`, and `thread/list {limit:1}`. Both catalog responses had a next page. No content or identities were printed.
- Generated `TurnSteerParams` requires `threadId`, `input`, and `expectedTurnId`. Its expected-turn precondition is explicitly validated by the App Server protocol, unlike the follower wrapper examined earlier.
- Generated `ThreadStartParams` includes `projectId` and `cwd`. Live task execution has not been tested.
- A temporary App Server listening on a Unix socket in a mode-0700 temporary directory accepted two simultaneous WebSocket clients. Both initialized successfully and read the same first project and chat identities. Only equality booleans were printed; no titles, paths, or text were persisted.
- Test connections and server were stopped. No public/TCP port was exposed, Desktop was not restarted, and no model task was run.

The successful two-client test used the WebSocket-over-Unix transport directly. A preliminary `codex app-server proxy --sock` JSONL probe timed out. Therefore a launcher must use a tested JSONL-to-WebSocket bridge; it must not assume that this CLI proxy invocation is a drop-in JSONL bridge.

The protocol test borrowed the existing Playwright bundle's WebSocket implementation only for a disposable experiment. Production transport must declare its own reviewed dependency and must not depend on Playwright internals.

## Desktop attachment candidate

Installed `app.asar` entry `/.vite/build/early-bootstrap-824-3c24dda6dba622ec.js` contains an absolute-path `CODEX_CLI_PATH` executable override. It preserves the standard stdio transport, startup arguments, configuration overrides, working directory, and inherited/injected runtime environment when spawning that executable.

A small reviewed launcher could intercept the primary App Server invocation, start the real bundled binary with the original arguments and environment but a private Unix listener, then bridge Desktop's JSONL stdin/stdout to a WebSocket client on that socket. The Telegram connector attaches as a second client. Other CLI commands must pass through to the actual bundled binary.

This is a proposed custom integration using an installed executable override, not a documented turnkey Desktop feature. It does not patch the signed application or impersonate an app-tools caller. Desktop must be relaunched to use it; active turns cannot be moved into the shared process by the research probe.

Required launcher constraints:

- Parse global flags before `app-server`: the observed default begins `-c features.code_mode_host=true app-server --analytics-default-enabled`, followed by additional configuration overrides.
- Intercept only the primary server invocation. Pass through help, schema generation, daemon/proxy, code-mode-host, and other CLI functions.
- Keep auxiliary Desktop server invocations isolated, including preview servers with different permissions. Never attach all server invocations to one socket.
- Preserve all settings/environment except the explicit transport replacement; never log raw arguments or environment values.
- Use a private directory and verify socket ownership/permissions. The remote relay never connects directly to this socket.
- Supervise backend and bridge lifecycle. Do not leave an orphaned server or reconnect to stale settings/runtime pipe identities.
- Account for `CODEX_APP_RUNTIME_CLI_PATH` pointing back to the launcher; passthrough must avoid recursion.
- Keep Desktop as the authority for its app tools, attestation, and existing approval behavior. A successful protocol connection does not prove those features survive the process-chain change.

## Alternatives inspected

`CODEX_APP_SERVER_WS_URL` selects a built-in direct WebSocket transport, but skips Desktop stdio configuration/environment behavior. No local bearer-token setup matching the CLI's authenticated TCP mode was established. It is not the preferred route.

`CODEX_APP_SERVER_USE_LOCAL_DAEMON=1` exists, but its selection requires no startup overrides. Normal local startup appears to supply a plugin override, so the flag alone is not a verified solution for this build. No managed daemon was running at the default control socket during inspection.

The native app-tools pipe still requires legitimate peer/caller context. This design does not extract its nonce, impersonate a chat, or bypass authorization.

OpenAI also documents built-in phone remote access through ChatGPT. That can provide phone control separately, but is not the Telegram Mini App the user requested.

## Next verification milestone

Prepare and test the supervised launcher and bridge with fake Desktop streams and the installed App Server before changing Desktop startup. Include fragmentation, limits, backpressure, cancellation, schema errors, child crashes, passthrough, auxiliary-server isolation, and secret-free diagnostics.

Then, with current work safely finished, test an actual Desktop relaunch through the launcher. Verify unchanged catalog/history, new disposable chat creation, continuation, expected-turn steering, interruption, Desktop tools/attestation, approvals, event fan-out, and shutdown/reconnect. Provide an immediate rollback by launching Desktop normally without the override. Do not claim the full original gate passed until these checks pass.

The adapter, relay, bot router, and Mini App remain unimplemented. This investigation supplies a concrete replacement candidate and working read-only protocol proof, not a finished phone app.

## Sources

- [Telegram Mini Apps](https://core.telegram.org/bots/webapps): embedded interface, launch mechanisms, and identity validation.
- [Codex App Server](https://learn.chatgpt.com/docs/app-server): thread/turn APIs, version-specific schema generation, and Unix WebSocket transport. The documentation marks WebSocket transport experimental.
- [Codex CLI reference](https://learn.chatgpt.com/docs/cli/reference): listener and remote-control command distinctions.
- [Official Codex CLI source](https://github.com/openai/codex/blob/main/codex-rs/cli/src/main.rs): daemon/proxy and listener command declarations; installed-version evidence takes precedence.
- [Remote connections](https://learn.chatgpt.com/docs/remote-connections): built-in ChatGPT phone access and host availability requirements.
- [Earlier follower capability report](codex-mobile-capabilities.md): accurate limitations of the original transport; this report extends the investigation to a different transport.
