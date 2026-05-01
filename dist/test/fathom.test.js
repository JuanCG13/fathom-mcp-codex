import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { FathomClient, verifyFathomWebhook } from "../src/fathom.js";
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
