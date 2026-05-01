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
        process.env.FATHOM_DEFAULT_ACCOUNT = "inzaiq";
        process.env.FATHOM_ACCOUNTS = JSON.stringify([
            { id: "personal", label: "Personal", apiKey: "personal-key" },
            { id: "inzaiq", label: "InzaiQ", apiKey: "inzaiq-key" },
        ]);
        assert.deepEqual(listFathomAccounts(), [
            {
                id: "personal",
                label: "Personal",
                is_default: false,
                base_url: "https://api.fathom.ai/external/v1",
            },
            {
                id: "inzaiq",
                label: "InzaiQ",
                is_default: true,
                base_url: "https://api.fathom.ai/external/v1",
            },
        ]);
        assert.equal(getDefaultFathomAccount().id, "inzaiq");
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
        process.env.FATHOM_DEFAULT_ACCOUNT = "personal";
        process.env.FATHOM_ACCOUNTS = JSON.stringify([
            { id: "personal", label: "Personal", apiKey: "personal-key" },
            { id: "inzaiq", label: "InzaiQ", apiKey: "inzaiq-key" },
        ]);
        let apiKey = "";
        const fetchImpl = async (_url, init) => {
            apiKey = new Headers(init?.headers).get("X-Api-Key") ?? "";
            return new Response(JSON.stringify({ ok: true }), { status: 200 });
        };
        const client = createFathomClient({ account: "inzaiq", fetchImpl: fetchImpl });
        await client.get("/teams");
        assert.equal(apiKey, "inzaiq-key");
    }
    finally {
        restoreEnv("FATHOM_ACCOUNTS", previousAccounts);
        restoreEnv("FATHOM_DEFAULT_ACCOUNT", previousDefault);
        restoreEnv("FATHOM_API_KEY", previousApiKey);
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
