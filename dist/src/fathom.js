import crypto from "node:crypto";
export const DEFAULT_BASE_URL = "https://api.fathom.ai/external/v1";
export class FathomApiError extends Error {
    status;
    body;
    constructor(status, body) {
        super(`Fathom API request failed with status ${status}: ${body}`);
        this.name = "FathomApiError";
        this.status = status;
        this.body = body;
    }
}
export class FathomClient {
    apiKey;
    baseUrl;
    fetchImpl;
    constructor(options = {}) {
        const apiKey = options.apiKey ?? process.env.FATHOM_API_KEY;
        if (!apiKey) {
            throw new Error("FATHOM_API_KEY is required.");
        }
        this.apiKey = apiKey;
        this.baseUrl = (options.baseUrl ?? process.env.FATHOM_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
        this.fetchImpl = options.fetchImpl ?? fetch;
    }
    async get(path, query = {}) {
        return this.request("GET", path, query);
    }
    async post(path, body) {
        return this.request("POST", path, {}, body);
    }
    async delete(path) {
        return this.request("DELETE", path);
    }
    async request(method, path, query = {}, body) {
        const url = new URL(`${this.baseUrl}${path}`);
        for (const [key, value] of Object.entries(query)) {
            if (value === undefined)
                continue;
            if (Array.isArray(value)) {
                for (const item of value)
                    url.searchParams.append(key, item);
            }
            else {
                url.searchParams.set(key, String(value));
            }
        }
        const response = await this.fetchImpl(url, {
            method,
            headers: {
                "X-Api-Key": this.apiKey,
                ...(body ? { "Content-Type": "application/json" } : {}),
            },
            body: body ? JSON.stringify(body) : undefined,
        });
        if (response.status === 204)
            return { ok: true };
        const text = await response.text();
        if (!response.ok) {
            throw new FathomApiError(response.status, text);
        }
        if (!text)
            return { ok: true };
        return JSON.parse(text);
    }
}
export function verifyFathomWebhook(input) {
    const secret = input.secret ?? process.env.FATHOM_WEBHOOK_SECRET ?? process.env.FATHOM_WEBHOOK_API_KEY;
    if (!secret) {
        throw new Error("FATHOM_WEBHOOK_SECRET is required to verify webhook signatures.");
    }
    const webhookId = headerValue(input.headers, "webhook-id");
    const webhookTimestamp = headerValue(input.headers, "webhook-timestamp");
    const webhookSignature = headerValue(input.headers, "webhook-signature");
    if (!webhookId || !webhookTimestamp || !webhookSignature)
        return false;
    const timestamp = Number.parseInt(webhookTimestamp, 10);
    if (!Number.isFinite(timestamp))
        return false;
    const toleranceSeconds = input.toleranceSeconds ?? 300;
    const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1000);
    if (Math.abs(nowSeconds - timestamp) > toleranceSeconds)
        return false;
    const secretParts = secret.split("_");
    const secretPayload = secretParts.length > 1 ? secretParts.slice(1).join("_") : secret;
    const secretBytes = Buffer.from(secretPayload, "base64");
    const signedContent = `${webhookId}.${webhookTimestamp}.${input.rawBody}`;
    const expectedSignature = crypto.createHmac("sha256", secretBytes).update(signedContent).digest("base64");
    return webhookSignature
        .split(" ")
        .map((signature) => {
        const parts = signature.split(",");
        return parts.length > 1 ? parts[1] : parts[0];
    })
        .some((signature) => timingSafeEqualString(expectedSignature, signature));
}
function headerValue(headers, name) {
    const direct = headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()];
    if (Array.isArray(direct))
        return direct[0];
    return direct;
}
function timingSafeEqualString(left, right) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    if (leftBuffer.length !== rightBuffer.length)
        return false;
    return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}
export function jsonText(data) {
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify(data, null, 2),
            },
        ],
    };
}
