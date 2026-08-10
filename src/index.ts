#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createFathomClient, getDefaultFathomAccount, jsonText, listFathomAccounts, verifyFathomWebhook } from "./fathom.js";

const server = new McpServer({
  name: "fathom-mcp",
  version: "1.0.1",
});

const accountSchema = z.string().optional().describe("Optional Fathom account id from FATHOM_ACCOUNTS.");
const client = (account?: string) => createFathomClient({ account });

const triggeredForSchema = z
  .array(z.enum(["my_recordings", "shared_external_recordings", "my_shared_with_team_recordings", "shared_team_recordings"]))
  .min(1);

server.registerTool(
  "fathom_list_accounts",
  {
    title: "List Fathom accounts",
    description: "List configured Fathom accounts without exposing API keys.",
    inputSchema: {},
  },
  async () => jsonText({ accounts: listFathomAccounts() }),
);

server.registerTool(
  "fathom_get_default_account",
  {
    title: "Get default Fathom account",
    description: "Show which configured Fathom account is used when no account is specified.",
    inputSchema: {},
  },
  async () => jsonText({ account: getDefaultFathomAccount() }),
);

server.registerTool(
  "fathom_list_meetings",
  {
    title: "List Fathom meetings",
    description:
      "List meetings recorded by you or shared with your team. Optionally include transcript, summary, action items, and CRM matches.",
    inputSchema: {
      account: accountSchema,
      cursor: z.string().optional(),
      created_after: z.string().optional(),
      created_before: z.string().optional(),
      include_transcript: z.boolean().optional(),
      include_summary: z.boolean().optional(),
      include_action_items: z.boolean().optional(),
      include_crm_matches: z.boolean().optional(),
      recorded_by: z.array(z.string().email()).optional(),
      teams: z.array(z.string()).optional(),
      calendar_invitees_domains: z.array(z.string()).optional(),
      calendar_invitees_domains_type: z.enum(["all", "only_internal", "one_or_more_external"]).optional(),
    },
  },
  async (input) =>
    jsonText(
      await client(input.account).get("/meetings", {
        cursor: input.cursor,
        created_after: input.created_after,
        created_before: input.created_before,
        include_transcript: input.include_transcript,
        include_summary: input.include_summary,
        include_action_items: input.include_action_items,
        include_crm_matches: input.include_crm_matches,
        "recorded_by[]": input.recorded_by,
        "teams[]": input.teams,
        "calendar_invitees_domains[]": input.calendar_invitees_domains,
        calendar_invitees_domains_type: input.calendar_invitees_domains_type,
      }),
    ),
);

server.registerTool(
  "fathom_get_recording_summary",
  {
    title: "Get Fathom recording summary",
    description: "Get the summary for a Fathom recording, or send it asynchronously to a destination URL.",
    inputSchema: {
      account: accountSchema,
      recording_id: z.number().int().positive(),
      destination_url: z.string().url().optional(),
    },
  },
  async ({ account, recording_id, destination_url }) =>
    jsonText(await client(account).get(`/recordings/${recording_id}/summary`, { destination_url })),
);

server.registerTool(
  "fathom_get_recording_transcript",
  {
    title: "Get Fathom recording transcript",
    description: "Get the transcript for a Fathom recording, or send it asynchronously to a destination URL.",
    inputSchema: {
      account: accountSchema,
      recording_id: z.number().int().positive(),
      destination_url: z.string().url().optional(),
    },
  },
  async ({ account, recording_id, destination_url }) =>
    jsonText(await client(account).get(`/recordings/${recording_id}/transcript`, { destination_url })),
);

server.registerTool(
  "fathom_get_recording_content",
  {
    title: "Get Fathom recording content",
    description: "Fetch both summary and transcript for a Fathom recording and return them together.",
    inputSchema: {
      account: accountSchema,
      recording_id: z.number().int().positive(),
    },
  },
  async ({ account, recording_id }) => {
    const api = client(account);
    const [summary, transcript] = await Promise.all([
      api.get(`/recordings/${recording_id}/summary`),
      api.get(`/recordings/${recording_id}/transcript`),
    ]);
    return jsonText({ recording_id, summary, transcript });
  },
);

server.registerTool(
  "fathom_list_teams",
  {
    title: "List Fathom teams",
    description: "List teams visible to the authenticated Fathom API key.",
    inputSchema: {
      account: accountSchema,
      cursor: z.string().optional(),
    },
  },
  async ({ account, cursor }) => jsonText(await client(account).get("/teams", { cursor })),
);

server.registerTool(
  "fathom_list_team_members",
  {
    title: "List Fathom team members",
    description: "List Fathom team members, optionally filtered by team name.",
    inputSchema: {
      account: accountSchema,
      cursor: z.string().optional(),
      team: z.string().optional(),
    },
  },
  async ({ account, cursor, team }) => jsonText(await client(account).get("/team_members", { cursor, team })),
);

server.registerTool(
  "fathom_create_webhook",
  {
    title: "Create Fathom webhook",
    description:
      "Create a Fathom webhook for new meeting content. At least one include_* option must be true.",
    inputSchema: {
      account: accountSchema,
      destination_url: z.string().url(),
      triggered_for: triggeredForSchema.default(["my_recordings"]),
      include_transcript: z.boolean().optional(),
      include_summary: z.boolean().optional(),
      include_action_items: z.boolean().optional(),
      include_crm_matches: z.boolean().optional(),
    },
  },
  async (input) => {
    const includes = [
      input.include_transcript,
      input.include_summary,
      input.include_action_items,
      input.include_crm_matches,
    ];
    if (!includes.some(Boolean)) {
      throw new Error("At least one of include_transcript, include_summary, include_action_items, or include_crm_matches must be true.");
    }

    return jsonText(
      await client(input.account).post("/webhooks", {
        destination_url: input.destination_url,
        triggered_for: input.triggered_for,
        include_transcript: input.include_transcript ?? false,
        include_summary: input.include_summary ?? false,
        include_action_items: input.include_action_items ?? false,
        include_crm_matches: input.include_crm_matches ?? false,
      }),
    );
  },
);

server.registerTool(
  "fathom_delete_webhook",
  {
    title: "Delete Fathom webhook",
    description: "Delete a Fathom webhook by ID.",
    inputSchema: {
      account: accountSchema,
      id: z.string().min(1),
    },
  },
  async ({ account, id }) => jsonText(await client(account).delete(`/webhooks/${encodeURIComponent(id)}`)),
);

server.registerTool(
  "fathom_verify_webhook",
  {
    title: "Verify Fathom webhook signature",
    description:
      "Verify Fathom webhook headers and raw request body using FATHOM_WEBHOOK_SECRET or an explicit secret.",
    inputSchema: {
      headers: z.record(z.string(), z.union([z.string(), z.array(z.string())]).optional()),
      raw_body: z.string(),
      secret: z.string().optional(),
      tolerance_seconds: z.number().int().positive().optional(),
    },
  },
  async ({ headers, raw_body, secret, tolerance_seconds }) =>
    jsonText({
      valid: verifyFathomWebhook({
        headers,
        rawBody: raw_body,
        secret,
        toleranceSeconds: tolerance_seconds,
      }),
    }),
);

const transport = new StdioServerTransport();
await server.connect(transport);
