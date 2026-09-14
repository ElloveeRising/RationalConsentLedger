# Exa MCP setup

Exa gives Claude live web search and page fetching. This repo ships an
[`.mcp.json`](../.mcp.json) that wires it up, but **the API key never lives in this
repo** — it is read from the `EXA_API_KEY` environment variable at launch.

Canonical docs: <https://docs.exa.ai/reference/exa-mcp>

## Which path applies to you

| Where you're running Claude | What to do | Key needed? |
| --- | --- | --- |
| Phone / Desktop / Web app | Built-in Exa connector | No |
| Claude Code on your own machine | Plugin, or this repo's `.mcp.json` | Yes |
| Claude Code on the web (claude.ai/code) | Not available — see below | N/A |

### Phone, Desktop, or Web app

Use the official connector; there is no config file and no key to paste.

1. In a new chat, tap **+** and choose **Add connector**.
2. Search for **Exa**, open it, and select **Connect to Claude**.
3. Authorize when prompted, then start a new chat.

Do not hand-edit `claude_desktop_config.json` for Exa — the connector is the
supported path.

### Claude Code on your own machine

Simplest route, no key handling at all:

```bash
claude plugin install exa@claude-plugins-official
```

Start a new session (plugins load at session start) and complete the Exa
sign-in that opens in your browser on first use.

To use this repo's `.mcp.json` instead, export the key in the shell profile on
that machine, so it is set before Claude Code starts:

```bash
# ~/.zshrc or ~/.bashrc
export EXA_API_KEY="paste-your-key-here"
```

Then reload the shell and start Claude Code from the repo root. Claude Code
expands `${EXA_API_KEY}` into the `x-api-key` header and will prompt you once to
approve the server. If the variable is unset the server fails to start with a
clear error rather than silently sending an empty key.

Get a key at <https://dashboard.exa.ai/api-keys>.

### Claude Code on the web

Remote web sessions run in a sandbox whose egress proxy denies `*.exa.ai`
(the CONNECT tunnel returns `403 Forbidden`). Exa cannot reach the network from
there, and an API key does not change that. Use Exa locally or via the app
connector instead.

## Tools

`web_search_exa` and `web_fetch_exa` are enabled by default. `agent_run`
(multi-step research) and `web_search_advanced_exa` (category/domain/date
filters, highlights, summaries, subpage crawling) are opt-in — request them
explicitly by appending `?tools=` to the URL in `.mcp.json`:

```
https://mcp.exa.ai/mcp?tools=web_search_exa,web_fetch_exa,agent_run,web_search_advanced_exa
```

## Verifying

In a fresh session, ask for something that needs the live web — e.g. "Search for
recent developments in AI agents and summarize the key trends." The
`web_search_exa` tool should be called.

## Troubleshooting

- **Tools missing** — restart the client fully; MCP servers are detected at startup.
- **429, or the first search hangs and times out** — the anonymous free tier is
  used up. Set `EXA_API_KEY` as above.
- **Server fails to start citing `EXA_API_KEY`** — the variable is not set in the
  environment Claude Code inherited. Export it in your shell profile, not just
  the current terminal.

## Key hygiene

- The key belongs in your environment or your password manager, never in a file
  under version control.
- `.env` and friends are gitignored. Keep it that way.
- If a key is ever pasted into a commit, chat, or issue, treat it as burned:
  rotate it at <https://dashboard.exa.ai/api-keys>.
