# OpenRouter Agent TUI

Terminal coding agent using [@openrouter/agent](https://www.npmjs.com/package/@openrouter/agent).

Scaffolded from [OpenRouter create-agent-tui skill](https://github.com/OpenRouterTeam/skills/tree/main/skills/create-agent-tui).

## Setup

1. Copy env:

```bash
cp .env.example .env
```

2. Add your key from [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys):

```env
OPENROUTER_API_KEY=sk-or-v1-...
```

3. Optional: edit `agent.config.json` (model, display style, loader).

## Run

```bash
npm start
```

Dev (auto-reload):

```bash
npm run dev
```

Typecheck:

```bash
npm run typecheck
```

## Defaults

- **Tools:** file read/write/edit, glob, grep, list_dir, shell, custom template
- **Server tools:** web search, datetime (UTC)
- **Input:** block style with adaptive terminal background
- **Tool display:** grouped
- **Loader:** spinner + "Working"
- **Slash commands:** `/model`, `/new`, `/help`
- **Sessions:** JSONL in `.sessions/`

## Commands

| Input | Action |
|-------|--------|
| natural language | send to agent |
| `/model` | switch OpenRouter model |
| `/new` | fresh session |
| `/help` | list commands |
| `exit` | quit |

## Config

`agent.config.json` example:

```json
{
  "model": "openai/gpt-4o-mini",
  "display": {
    "inputStyle": "block",
    "toolDisplay": "grouped",
    "loader": { "text": "Working", "style": "spinner" }
  }
}
```

Env overrides: `AGENT_MODEL`, `AGENT_MAX_STEPS`, `AGENT_MAX_COST`.
