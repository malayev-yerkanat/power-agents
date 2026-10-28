#!/bin/bash
# Claude Code PermissionRequest hook: ask the paired Power Agents Telegram chat to Approve or Decline.
# Runs alongside the Mac dialog; whichever answers first wins. With no answer it prints nothing.
env_file="$(dirname "$0")/../.env"
setting() { grep -m1 "^$1=" "$env_file" | cut -d= -f2-; }
input=$(cat)
text=$(jq -r '"Claude Code needs approval\nProject: \(.cwd | split("/") | last)\nTool: \(.tool_name)\n\(.tool_input | (.command // .file_path // .url // tostring) | .[0:600])"' <<<"$input")

# Buttons go through the Power Agents server because it owns the bot's update polling.
api="http://127.0.0.1:$(setting PORT || true)"; [ "$api" = "http://127.0.0.1:" ] && api="http://127.0.0.1:4317"
jar=$(mktemp); trap 'rm -f "$jar"' EXIT
csrf=$(curl -sf -m 5 -c "$jar" "$api/api/bootstrap" | jq -r '.csrfToken // empty')
if [ -n "$csrf" ] && response=$(jq -n --arg text "$text" '{text: $text}' | curl -sf -m 590 -b "$jar" \
    -H "X-CSRF-Token: $csrf" -H 'Content-Type: application/json' --data-binary @- "$api/api/telegram/approval"); then
  case $(jq -r '.decision // empty' <<<"$response") in
    allow) echo '{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"allow"}}}' ;;
    deny) echo '{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"deny","message":"Declined from Telegram."}}}' ;;
  esac
  exit 0
fi

# Server down or Telegram unavailable: send a plain alert so the request is not missed.
token=$(setting TELEGRAM_BOT_TOKEN); chat=$(setting TELEGRAM_CHAT_ID)
[ -n "$token" ] && [ -n "$chat" ] || exit 0
curl -s -m 5 -o /dev/null "https://api.telegram.org/bot$token/sendMessage" \
  --data-urlencode "chat_id=$chat" --data-urlencode "text=$text (open the Mac to answer)" || true
exit 0
