import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { createFathomClient, FathomClient, getDefaultFathomAccount, listFathomAccounts, verifyFathomWebhook } from "../src/fathom.js";
test("FathomClient serializes repeated array query parameters", async () => {
    let requestedUrl = "";
    const fetchImpl = async (url) => {
        requestedUrl = String(url);
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };
    const client = new FathomClient({ apiKey: "test-key", fetchImpl: fetchImpl });
    await client.get("/meetings", {
        "teams[]": ["Sales", "Engineering"],
        include_summary: true,
    });
    const url = new URL(requestedUrl);
    assert.deepEqual(url.searchParams.getAll("teams[]"), ["Sales", "Engineering"]);
    assert.equal(url.searchParams.get("include_summary"), "true");
});
test("verifyFathomWebhook validates Fathom HMAC signatures", () => {
    const rawSecret = Buffer.from("test-secret").toString("base64");
    const secret = `whsec_${rawSecret}`;
    const id = "msg_123";
    const timestamp = "1800000000";
    const rawBody = JSON.stringify({ recording_id: 123 });
    const signature = crypto
        .createHmac("sha256", Buffer.from(rawSecret, "base64"))
        .update(`${id}.${timestamp}.${rawBody}`)
        .digest("base64");
    assert.equal(verifyFathomWebhook({
        secret,
        headers: {
            "webhook-id": id,
            "webhook-timestamp": timestamp,
            "webhook-signature": `v1,${signature}`,
        },
        rawBody,
        nowSeconds: 1800000000,
    }), true);
});
test("listFathomAccounts returns safe account metadata", () => {
    const previousAccounts = process.env.FATHOM_ACCOUNTS;
    const previousDefault = process.env.FATHOM_DEFAULT_ACCOUNT;
    const previousApiKey = process.env.FATHOM_API_KEY;
    try {
        delete process.env.FATHOM_API_KEY;
        process.env.FATHOM_DEFAULT_ACCOUNT = "engineering";
        process.env.FATHOM_ACCOUNTS = JSON.stringify([
            { id: "primary", label: "Primary", apiKey: "primary-key" },
            { id: "engineering", label: "Engineering", apiKey: "engineering-key" },
        ]);
        assert.deepEqual(listFathomAccounts(), [
            {
                id: "primary",
                label: "Primary",
                is_default: false,
                base_url: "https://api.fathom.ai/external/v1",
            },
            {
                id: "engineering",
                label: "Engineering",
                is_default: true,
                base_url: "https://api.fathom.ai/external/v1",
            },
        ]);
        assert.equal(getDefaultFathomAccount().id, "engineering");
    }
    finally {
        restoreEnv("FATHOM_ACCOUNTS", previousAccounts);
        restoreEnv("FATHOM_DEFAULT_ACCOUNT", previousDefault);
        restoreEnv("FATHOM_API_KEY", previousApiKey);
    }
});
test("createFathomClient selects requested account", async () => {
    const previousAccounts = process.env.FATHOM_ACCOUNTS;
    const previousDefault = process.env.FATHOM_DEFAULT_ACCOUNT;
    const previousApiKey = process.env.FATHOM_API_KEY;
    try {
        delete process.env.FATHOM_API_KEY;
        process.env.FATHOM_DEFAULT_ACCOUNT = "primary";
        process.env.FATHOM_ACCOUNTS = JSON.stringify([
            { id: "primary", label: "Primary", apiKey: "primary-key" },
            { id: "engineering", label: "Engineering", apiKey: "engineering-key" },
        ]);
        let apiKey = "";
        const fetchImpl = async (_url, init) => {
            apiKey = new Headers(init?.headers).get("X-Api-Key") ?? "";
            return new Response(JSON.stringify({ ok: true }), { status: 200 });
        };
        const client = createFathomClient({ account: "engineering", fetchImpl: fetchImpl });
        await client.get("/teams");
        assert.equal(apiKey, "engineering-key");
    }
    finally {
        restoreEnv("FATHOM_ACCOUNTS", previousAccounts);
        restoreEnv("FATHOM_DEFAULT_ACCOUNT", previousDefault);
        restoreEnv("FATHOM_API_KEY", previousApiKey);
    }
});
test("FATHOM_ACCOUNTS accepts relaxed JavaScript-style object keys", () => {
    const previousAccounts = process.env.FATHOM_ACCOUNTS;
    const previousDefault = process.env.FATHOM_DEFAULT_ACCOUNT;
    const previousApiKey = process.env.FATHOM_API_KEY;
    try {
        delete process.env.FATHOM_API_KEY;
        process.env.FATHOM_DEFAULT_ACCOUNT = "sales";
        process.env.FATHOM_ACCOUNTS = `[
      {id:"sales",label:"Sales",apiKey:"sales-key"},
      {id:"operations",label:"Operations",apiKey:"operations-key"},
    ]`;
        assert.deepEqual(listFathomAccounts().map((account) => ({ id: account.id, label: account.label, is_default: account.is_default })), [
            { id: "sales", label: "Sales", is_default: true },
            { id: "operations", label: "Operations", is_default: false },
        ]);
    }
    finally {
        restoreEnv("FATHOM_ACCOUNTS", previousAccounts);
        restoreEnv("FATHOM_DEFAULT_ACCOUNT", previousDefault);
        restoreEnv("FATHOM_API_KEY", previousApiKey);
    }
});
test("individual account environment variables avoid JSON parsing", () => {
    const previousAccounts = process.env.FATHOM_ACCOUNTS;
    const previousDefault = process.env.FATHOM_DEFAULT_ACCOUNT;
    const previousApiKey = process.env.FATHOM_API_KEY;
    const previousSalesKey = process.env.FATHOM_ACCOUNT_SALES_API_KEY;
    const previousSalesLabel = process.env.FATHOM_ACCOUNT_SALES_LABEL;
    const previousOperationsKey = process.env.FATHOM_ACCOUNT_OPERATIONS_API_KEY;
    const previousOperationsLabel = process.env.FATHOM_ACCOUNT_OPERATIONS_LABEL;
    try {
        delete process.env.FATHOM_ACCOUNTS;
        delete process.env.FATHOM_API_KEY;
        process.env.FATHOM_DEFAULT_ACCOUNT = "operations";
        process.env.FATHOM_ACCOUNT_SALES_API_KEY = "sales-key";
        process.env.FATHOM_ACCOUNT_SALES_LABEL = "Sales";
        process.env.FATHOM_ACCOUNT_OPERATIONS_API_KEY = "operations-key";
        process.env.FATHOM_ACCOUNT_OPERATIONS_LABEL = "Operations";
        assert.deepEqual(listFathomAccounts().map((account) => ({ id: account.id, label: account.label, is_default: account.is_default })), [
            { id: "operations", label: "Operations", is_default: true },
            { id: "sales", label: "Sales", is_default: false },
        ]);
    }
    finally {
        restoreEnv("FATHOM_ACCOUNTS", previousAccounts);
        restoreEnv("FATHOM_DEFAULT_ACCOUNT", previousDefault);
        restoreEnv("FATHOM_API_KEY", previousApiKey);
        restoreEnv("FATHOM_ACCOUNT_SALES_API_KEY", previousSalesKey);
        restoreEnv("FATHOM_ACCOUNT_SALES_LABEL", previousSalesLabel);
        restoreEnv("FATHOM_ACCOUNT_OPERATIONS_API_KEY", previousOperationsKey);
        restoreEnv("FATHOM_ACCOUNT_OPERATIONS_LABEL", previousOperationsLabel);
    }
});
function restoreEnv(name, value) {
    if (value === undefined) {
        delete process.env[name];
    }
    else {
        process.env[name] = value;
    }
}
