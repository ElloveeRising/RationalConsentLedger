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
| Claude Code on the web (claude.ai/code) | Same connector — it carries over | No |

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

The connector works here too. Once it is authorized on your account, the Exa
tools appear in remote web sessions automatically — no key, no config.

This is worth understanding, because the sandbox *does* block Exa. Direct egress
to `*.exa.ai` is denied by the environment's proxy:

```
CONNECT mcp.exa.ai:443 HTTP/1.1
< HTTP/1.1 403 Forbidden
```

The connector is unaffected because it is not a direct connection. It routes
through `mcp-proxy.anthropic.com`, which sits on the proxy's bypass list. So the
connector reaches Exa where a hand-rolled `.mcp.json` in the same session cannot.

Practical consequence: in a remote session, use the connector. The `.mcp.json` in
this repo is for Claude Code running on your own machine, where direct egress is
not restricted.

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

## What it costs

Rates from [Exa's pricing page](https://exa.ai/docs/reference/pricing). Exa is
pay-as-you-go with no subscription — you are billed per request.

| Endpoint | Price |
| --- | --- |
| `/search` — base, up to 10 results, text + highlights included | $7 / 1k requests |
| each result beyond 10 | $1 / 1k results |
| `/contents` (`web_fetch_exa`) | $1 / 1k pages, **per content type** |
| AI page summaries | $1 / 1k pages |
| `/answer` | $5 / 1k requests |

A "content type" is one view of a page — `text`, `highlights`, or `summary`. One
page fetched with both `text` and `highlights` bills as two.

So an ordinary search is **$0.007** and a page fetch is **$0.001**. These are
cheap enough to ignore.

### The Agent API is the exception

`agent_run` is where real money goes. Fixed-effort runs are predictable:

| Effort | Price per run |
| --- | --- |
| `minimal` | $0.012 |
| `low` | $0.025 |
| `medium` | $0.10 |
| `high` | $0.50 |
| `xhigh` | $1.00 |

But the **default effort is `auto`**, which is metered rather than fixed and
runs up to a **$5 per-run cap**. Beta `max` caps at **$20 per run**. Metered runs
bill at $0.10 per Agent Compute Unit plus $0.005 per search tool call, with
contact enrichment charged separately ($0.02 / email, $0.07 / phone number).

One `max` run can therefore cost more than 2,800 ordinary searches.

### Keeping it cheap

- Prefer `web_search_exa` and `web_fetch_exa`. They are the cheap tools and cover
  most needs.
- Keep `numResults` at or below 10 — beyond that you pay per extra result.
- Treat `agent_run` as a deliberate choice, not a default. When you do use it,
  pass an explicit fixed `effort`, or set `budget.maxCostDollars` to cap a
  metered run.
- Skip AI summaries unless you want them; raw text and highlights are already
  included in the search price.

### Billing safety

With no payment method on the account, the credit balance is a hard ceiling.
Requests start failing when it runs out; nothing auto-charges. Adding a card for
automatic top-ups removes that ceiling, so leave it off unless you want it gone.
