#!/bin/bash
# Claude Code Stop hook: tell the paired Telegram chat that a turn ended, with its recap and any open question.
# When the question has options, they come as buttons; a tap is handed back to Claude as your answer.
env_file="$(dirname "$0")/../.env"
setting() { grep -m1 "^$1=" "$env_file" | cut -d= -f2-; }
input=$(cat)
transcript=$(jq -r '.transcript_path // empty' <<<"$input")
[ -f "$transcript" ] || exit 0

# Look only at the latest turn: everything after the last prompt the user typed.
turn=$(jq -cs --arg project "$(jq -r '.cwd | split("/") | last' <<<"$input")" '
  map(select(.isSidechain != true)) as $all
  | ([$all | to_entries[] | select(.value.type == "user" and (.value.message.content | type == "string" or any(.[]?; .type == "text"))) | .key] | last // -1) as $start
  | [$all[$start + 1:][] | select(.type == "assistant") | .message.content[]?] as $blocks
  | ([$blocks[] | select(.type == "tool_use" and (.name | endswith("__wrap_up"))) | .input] | last) as $wrap
  | ([$blocks[] | select(.type == "text") | .text] | last // "") as $reply
  | {actions: (if $wrap.ask then $wrap.actions // [] else [] end),
     text: ((if $wrap.ask then "Claude Code is waiting for you" else "Claude Code finished" end)
       + "\nProject: \($project)\n\n"
       + (($wrap.recap // $reply) | .[0:1200])
       + (if $wrap.ask then "\n\nQuestion: \($wrap.ask)" else "" end))}
' "$transcript" 2>/dev/null) || exit 0
text=$(jq -r '.text' <<<"$turn")
[ -n "$text" ] || exit 0

# Options become buttons through the Power Agents server, which owns the bot's update polling.
if [ "$(jq '.actions | length' <<<"$turn")" -gt 0 ]; then
  api="http://127.0.0.1:$(setting PORT || true)"; [ "$api" = "http://127.0.0.1:" ] && api="http://127.0.0.1:4317"
  jar=$(mktemp); trap 'rm -f "$jar"' EXIT
  csrf=$(curl -sf -m 5 -c "$jar" "$api/api/bootstrap" | jq -r '.csrfToken // empty')
  if [ -n "$csrf" ] && response=$(jq '{text, options: [.actions[].label // "Option" | .[0:40]]}' <<<"$turn" | curl -sf -m 590 -b "$jar" \
      -H "X-CSRF-Token: $csrf" -H 'Content-Type: application/json' --data-binary @- "$api/api/telegram/question"); then
    choice=$(jq -r '.choice // empty' <<<"$response")
    [ -n "$choice" ] && jq --argjson i "$choice" '.actions[$i] | {decision: "block",
      reason: "The user answered from Telegram: \(.message // .label)"}' <<<"$turn"
    exit 0
  fi
  text="$text
Options: $(jq -r '[.actions[].label] | join(" / ")' <<<"$turn") (open the Mac to answer)"
fi

token=$(setting TELEGRAM_BOT_TOKEN); chat=$(setting TELEGRAM_CHAT_ID)
[ -n "$token" ] && [ -n "$chat" ] || exit 0
curl -s -m 5 -o /dev/null "https://api.telegram.org/bot$token/sendMessage" \
  --data-urlencode "chat_id=$chat" --data-urlencode "text=$text" || true
exit 0
