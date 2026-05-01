# Fathom MCP for Codex

Codex plugin and local MCP server for [Fathom AI Notetaker](https://developers.fathom.ai/). It connects Codex to Fathom meetings, recording summaries, transcripts, teams, team members, webhook creation/deletion, and webhook signature verification.

Developed by the [InzaiQ LLC](https://www.inzaiq.com/) team, specialists in custom software, applied AI, automation, and crypto engineering.

## Requirements

- Node.js 20 or newer
- Codex CLI
- A Fathom API key from Fathom User Settings > API Access
- Optional webhook secret for signature verification

## Quick Install

This is the simplest install path. It uses `npx` to run the MCP server directly from GitHub, so you do not need to clone or build this repository.

### 1. Get your Fathom API key

Open Fathom, then go to:

```text
User Settings > API Access
```

Create or copy your API key.

### 2. Export the API key

In your terminal:

```bash
export FATHOM_API_KEY="your_fathom_api_key"
```

### 3. Add Fathom to Codex

```bash
codex mcp add fathom --env FATHOM_API_KEY="$FATHOM_API_KEY" -- npx -y github:JuanCG13/fathom-mcp-codex
```

### 4. Verify the MCP server is registered

```bash
codex mcp list
```

You should see a server named `fathom`.

### 5. Use it in Codex

Open Codex and ask:

```text
List my latest Fathom meetings.
```

Other useful prompts:

```text
Get the transcript for my latest Fathom recording.
Summarize my most recent Fathom meeting.
List my Fathom teams.
```

## Multiple Fathom Accounts

You can connect more than one Fathom account to the same MCP server. Use this when you have separate API keys for personal, company, or client workspaces.

If `FATHOM_ACCOUNTS` is set, it takes precedence over `FATHOM_API_KEY`.

### Bash or macOS/Linux

```bash
export FATHOM_ACCOUNTS='[
  {"id":"personal","label":"Personal","apiKey":"your_personal_fathom_api_key"},
  {"id":"inzaiq","label":"InzaiQ","apiKey":"your_inzaiq_fathom_api_key"}
]'
export FATHOM_DEFAULT_ACCOUNT="inzaiq"

codex mcp add fathom \
  --env FATHOM_ACCOUNTS="$FATHOM_ACCOUNTS" \
  --env FATHOM_DEFAULT_ACCOUNT="$FATHOM_DEFAULT_ACCOUNT" \
  -- npx -y github:JuanCG13/fathom-mcp-codex
```

### Windows PowerShell

```powershell
$env:FATHOM_ACCOUNTS='[
  {"id":"personal","label":"Personal","apiKey":"your_personal_fathom_api_key"},
  {"id":"inzaiq","label":"InzaiQ","apiKey":"your_inzaiq_fathom_api_key"}
]'
$env:FATHOM_DEFAULT_ACCOUNT="inzaiq"

codex mcp add fathom `
  --env FATHOM_ACCOUNTS="$env:FATHOM_ACCOUNTS" `
  --env FATHOM_DEFAULT_ACCOUNT="$env:FATHOM_DEFAULT_ACCOUNT" `
  -- npx -y github:JuanCG13/fathom-mcp-codex
```

### Using accounts in Codex

Ask Codex naturally:

```text
List my configured Fathom accounts.
List my latest Fathom meetings from the InzaiQ account.
Get the transcript for recording 123456789 from the personal account.
```

Every Fathom tool accepts an optional `account` id. If no account is specified, the MCP server uses `FATHOM_DEFAULT_ACCOUNT`. If no default is set, it uses the first account in `FATHOM_ACCOUNTS`.

Account ids may contain letters, numbers, underscores, and hyphens. API keys are never returned by the account-listing tool.

## Codex Desktop on Windows

Codex Desktop can use this MCP server as long as you register it in the same environment where Codex Desktop runs.

### Windows native install

Use this path if you run Codex Desktop as a normal Windows app.

Requirements:

- Node.js 20 or newer installed on Windows
- Git installed on Windows
- Codex CLI available in PowerShell

Open PowerShell and run:

```powershell
$env:FATHOM_API_KEY="your_fathom_api_key"

codex mcp add fathom --env FATHOM_API_KEY="$env:FATHOM_API_KEY" -- npx -y github:JuanCG13/fathom-mcp-codex
```

Verify:

```powershell
codex mcp list
```

Then restart Codex Desktop and ask:

```text
List my latest Fathom meetings.
```

### Windows native install with webhook verification

```powershell
$env:FATHOM_API_KEY="your_fathom_api_key"
$env:FATHOM_WEBHOOK_SECRET="whsec_your_webhook_secret"

codex mcp add fathom `
  --env FATHOM_API_KEY="$env:FATHOM_API_KEY" `
  --env FATHOM_WEBHOOK_SECRET="$env:FATHOM_WEBHOOK_SECRET" `
  -- npx -y github:JuanCG13/fathom-mcp-codex
```

### WSL note

If you run the install command inside WSL, the MCP server is registered for Codex running inside WSL. That may not be visible to Codex Desktop running as a native Windows app.

For Codex Desktop on Windows, run the install command in Windows PowerShell, not inside WSL.

## Optional Webhook Setup

If you want Codex to verify Fathom webhook signatures, also export the webhook secret returned by Fathom when you create a webhook:

```bash
export FATHOM_WEBHOOK_SECRET="whsec_your_webhook_secret"
```

If you already added the MCP server without the webhook secret, remove and add it again:

```bash
codex mcp remove fathom

codex mcp add fathom \
  --env FATHOM_API_KEY="$FATHOM_API_KEY" \
  --env FATHOM_WEBHOOK_SECRET="$FATHOM_WEBHOOK_SECRET" \
  -- npx -y github:JuanCG13/fathom-mcp-codex
```

`FATHOM_WEBHOOK_API_KEY` is also supported as a backward-compatible alias for `FATHOM_WEBHOOK_SECRET`.

## Update

This MCP server is normally installed through `npx` from GitHub. To make Codex fetch the latest version, remove and add the server again.

Single-account update:

```bash
codex mcp remove fathom

codex mcp add fathom --env FATHOM_API_KEY="$FATHOM_API_KEY" -- npx -y github:JuanCG13/fathom-mcp-codex
```

Multi-account update:

```bash
codex mcp remove fathom

codex mcp add fathom \
  --env FATHOM_ACCOUNTS="$FATHOM_ACCOUNTS" \
  --env FATHOM_DEFAULT_ACCOUNT="$FATHOM_DEFAULT_ACCOUNT" \
  -- npx -y github:JuanCG13/fathom-mcp-codex
```

Windows PowerShell:

```powershell
codex mcp remove fathom

codex mcp add fathom `
  --env FATHOM_ACCOUNTS="$env:FATHOM_ACCOUNTS" `
  --env FATHOM_DEFAULT_ACCOUNT="$env:FATHOM_DEFAULT_ACCOUNT" `
  -- npx -y github:JuanCG13/fathom-mcp-codex
```

## Install From Source

Use this only if you want to modify the plugin locally.

```bash
git clone https://github.com/JuanCG13/fathom-mcp-codex.git
cd fathom-mcp-codex
npm install
npm run build
```

The Codex plugin manifest lives at `.codex-plugin/plugin.json`, and MCP configuration lives at `.mcp.json`. Built JavaScript is included in `dist/index.js` so the plugin can start directly from the MCP config after installation.

## MCP Tools

- `fathom_list_meetings`: list meetings with filters and optional summary/transcript/action items/CRM data.
- `fathom_list_accounts`: list configured Fathom accounts without exposing API keys.
- `fathom_get_default_account`: show the account used when no account is specified.
- `fathom_get_recording_summary`: fetch a recording summary or send it to a destination URL.
- `fathom_get_recording_transcript`: fetch a recording transcript or send it to a destination URL.
- `fathom_get_recording_content`: fetch summary and transcript together.
- `fathom_list_teams`: list teams visible to the API key.
- `fathom_list_team_members`: list team members, optionally filtered by team.
- `fathom_create_webhook`: create a webhook for meeting content.
- `fathom_delete_webhook`: delete a webhook by ID.
- `fathom_verify_webhook`: verify Fathom webhook headers and raw body.

## Development

```bash
npm run check
npm test
```

## Notes

Fathom API keys are user-scoped. They can access meetings recorded by the key owner and meetings shared to their team according to Fathom's access rules.
