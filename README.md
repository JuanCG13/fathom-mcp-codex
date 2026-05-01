# Fathom MCP for Codex

Codex plugin and local MCP server for [Fathom AI Notetaker](https://developers.fathom.ai/). It connects Codex to Fathom meetings, recording summaries, transcripts, teams, team members, webhook creation/deletion, and webhook signature verification.

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

## Install From Source

Use this only if you want to modify the plugin locally.

```bash
git clone https://github.com/juan-jesus-cubells/fathom-mcp-codex.git
cd fathom-mcp-codex
npm install
npm run build
```

The Codex plugin manifest lives at `.codex-plugin/plugin.json`, and MCP configuration lives at `.mcp.json`. Built JavaScript is included in `dist/index.js` so the plugin can start directly from the MCP config after installation.

## MCP Tools

- `fathom_list_meetings`: list meetings with filters and optional summary/transcript/action items/CRM data.
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
