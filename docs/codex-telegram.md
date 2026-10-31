# Codex Desktop and Telegram

The Power Agents background service can mirror supported Codex Desktop permission requests and structured questions to a dedicated Codex Telegram bot. Claude keeps its existing bot, pairing, and poller.

Set `CODEX_TELEGRAM_BOT_TOKEN` to the new BotFather token and `CODEX_TELEGRAM_ENABLED=true` in the project's ignored `.env`, then run `npm run service:restart`. Run `npm run codex:telegram:pair`, open the generated one-use Telegram link, and press **Start**. Check the connection with `npm run codex:telegram:status`. Never paste tokens into chat or commit `.env`. No Codex approval policy, hook trust, app files, credentials, or sandbox settings are changed. Set the flag to `false` and restart to disable the bridge.

## Using it

- Command and network approval messages show the complete available command, working directory, reason, and requested permissions. Choose **Approve once** or **Decline**; approval messages accept buttons only, so a typed reply is ignored. Broader session or policy approvals are never offered.
- Browser use download approvals and other MCP tool confirmations with an empty form and `codex_approval_kind: mcp_tool_call` also offer **Approve once / Decline**. The complete action parameters appear in the message; session/always grants are never forwarded. Authentication, OTP, user verification, URL flows, and forms requiring input remain desktop-only.
- Native permission requests show their complete requested grant. Approval applies only to the current turn; declining grants nothing.
- Structured questions appear with buttons. You can also use Telegram's **Reply** action on that exact message to type an answer. Ordinary messages to the bot are not forwarded.
- Desktop controls remain available. A resolved native request invalidates its Telegram controls. Only the paired user in the paired private chat can answer the exact sent message. Duplicate and expired responses are discarded.
- Async questions are sent back as ordinary user steering using the desktop's question-reply encoding. The bridge refreshes state and checks the active turn and unanswered question immediately before sending. The internal desktop API has no atomic expected-turn argument, so a narrow turn-transition race remains possible; it cannot grant permissions or start a new turn.

The Mac must be awake with Codex Desktop and Power Agents running. Pending prompts expire after at most 9½ minutes; timeouts and connection failures never approve anything. Restarting either service invalidates pending Telegram controls. Desktop remains available if Telegram fails.

## Scope and compatibility

Discovery reads only IDs from the 100 most recently updated, nonarchived, top-level local Codex chats. It attaches only when the desktop owns that chat. It does not attach a separate CLI daemon or remote host. Async questions are mirrored while their source turn is active. Plain prose questions are not inferred.

File-change approvals, plan/option-picker requests, other MCP elicitation, unknown schemas, secret questions, and requests too large to show completely remain desktop-only. Native command and permission prompts are bounded to fit Telegram without truncating security-relevant content.

The adapter uses **undocumented local Desktop IPC**, verified with bundled Codex `0.165.0-alpha.1.2`, IPC initialization version 0, follower operations version 1, and conversation snapshots version 11. It validates the private socket's ownership/permissions and pauses a chat on an incompatible snapshot version. Desktop updates can require adapter changes. The public [app-server protocol](https://learn.chatgpt.com/docs/app-server) documents approvals, but this installed desktop uses an in-process transport rather than an attachable app-server listener. A [PermissionRequest hook](https://learn.chatgpt.com/docs/hooks) alone runs before the normal desktop prompt and does not provide simultaneous controls.

Full desktop snapshots are transiently received to find pending structured prompts. The bridge does not log or persist snapshots, transcripts, bot credentials, or answers. Only the prompt details needed for the decision are sent to the paired Codex Telegram chat. Codex has an independent one-use pairing link, recipient, update offset, and private `.power-agents/codex-telegram.sqlite` database. Missing Codex credentials never fall back to Claude. Reusing the same bot identity is rejected to avoid competing pollers.

## Diagnostics and tests

The session-protected `GET /api/telegram/codex` reports whether the dedicated bot and bridge are enabled and their connection state. CSRF-protected `POST /api/telegram/codex/pair` creates its pairing link; the helper commands use these local endpoints. It exposes no chat contents. A disabled flag leaves the existing Telegram integration unchanged.

Focused tests: `node --import tsx --test tests/codex-*.test.ts tests/telegram*.test.ts`. They cover protocol framing, owner validation, discovery, snapshot/patch reconciliation, native approvals, canonical async history, desktop-first cancellation, typed replies, duplicate taps, and unauthorized replies. Socket tests require permission to bind local sockets. No test spends model quota or sends a live approval.
