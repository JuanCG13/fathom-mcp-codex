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
export function createFathomClient(selection = {}) {
    const account = resolveFathomAccount(selection.account);
    return new FathomClient({
        apiKey: account.apiKey,
        baseUrl: account.baseUrl,
        fetchImpl: selection.fetchImpl,
    });
}
export function listFathomAccounts() {
    const accounts = loadFathomAccounts();
    const defaultAccountId = resolveDefaultAccountId(accounts);
    return accounts.map((account) => ({
        id: account.id,
        label: account.label,
        is_default: account.id === defaultAccountId,
        base_url: account.baseUrl ?? process.env.FATHOM_BASE_URL ?? DEFAULT_BASE_URL,
    }));
}
export function getDefaultFathomAccount() {
    const account = resolveFathomAccount();
    return {
        id: account.id,
        label: account.label,
        is_default: true,
        base_url: account.baseUrl ?? process.env.FATHOM_BASE_URL ?? DEFAULT_BASE_URL,
    };
}
function resolveFathomAccount(accountId) {
    const accounts = loadFathomAccounts();
    if (accounts.length === 0) {
        throw new Error("Configure FATHOM_API_KEY or FATHOM_ACCOUNTS before using Fathom MCP tools.");
    }
    if (accountId) {
        const account = accounts.find((candidate) => candidate.id === accountId);
        if (!account) {
            throw new Error(`Unknown Fathom account '${accountId}'. Available accounts: ${accounts.map((account) => account.id).join(", ")}.`);
        }
        return account;
    }
    const defaultAccountId = resolveDefaultAccountId(accounts);
    const defaultAccount = accounts.find((account) => account.id === defaultAccountId);
    if (!defaultAccount) {
        throw new Error(`FATHOM_DEFAULT_ACCOUNT '${defaultAccountId}' does not match any configured account.`);
    }
    return defaultAccount;
}
function loadFathomAccounts() {
    if (process.env.FATHOM_ACCOUNTS?.trim()) {
        return parseFathomAccounts(process.env.FATHOM_ACCOUNTS);
    }
    const envAccounts = loadFathomAccountsFromIndividualEnv();
    if (envAccounts.length > 0) {
        return envAccounts;
    }
    if (process.env.FATHOM_API_KEY) {
        return [
            {
                id: "default",
                label: "Default",
                apiKey: process.env.FATHOM_API_KEY,
                baseUrl: process.env.FATHOM_BASE_URL,
            },
        ];
    }
    return [];
}
function parseFathomAccounts(rawAccounts) {
    const parsed = parseAccountsValue(rawAccounts);
    if (!Array.isArray(parsed)) {
        throw new Error("FATHOM_ACCOUNTS must be a JSON array.");
    }
    const accounts = parsed.map((account, index) => normalizeFathomAccount(account, index));
    const ids = new Set();
    for (const account of accounts) {
        if (ids.has(account.id)) {
            throw new Error(`FATHOM_ACCOUNTS contains duplicate account id '${account.id}'.`);
        }
        ids.add(account.id);
    }
    return accounts;
}
function parseAccountsValue(rawAccounts) {
    try {
        return JSON.parse(rawAccounts);
    }
    catch (jsonError) {
        const relaxed = toRelaxedJson(rawAccounts);
        try {
            return JSON.parse(relaxed);
        }
        catch (relaxedError) {
            const jsonMessage = jsonError instanceof Error ? jsonError.message : "Invalid JSON";
            const relaxedMessage = relaxedError instanceof Error ? relaxedError.message : "Invalid relaxed JSON";
            throw new Error(`FATHOM_ACCOUNTS must be a JSON array. Use strict JSON with double-quoted keys and values, or configure accounts with FATHOM_ACCOUNT_<ID>_API_KEY variables. JSON error: ${jsonMessage}. Relaxed parse error: ${relaxedMessage}`);
        }
    }
}
function toRelaxedJson(rawAccounts) {
    return rawAccounts
        .trim()
        .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_-]*)(\s*:)/g, '$1"$2"$3')
        .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_match, value) => JSON.stringify(value.replace(/\\'/g, "'")))
        .replace(/,\s*([}\]])/g, "$1");
}
function loadFathomAccountsFromIndividualEnv() {
    const ids = new Set();
    for (const key of Object.keys(process.env)) {
        const match = key.match(/^FATHOM_ACCOUNT_([A-Z0-9_]+)_API_KEY$/);
        if (match)
            ids.add(match[1].toLowerCase());
    }
    return [...ids].sort().map((id) => {
        const envId = id.toUpperCase();
        const apiKey = process.env[`FATHOM_ACCOUNT_${envId}_API_KEY`];
        if (!apiKey) {
            throw new Error(`FATHOM_ACCOUNT_${envId}_API_KEY must be a non-empty string.`);
        }
        return {
            id,
            label: process.env[`FATHOM_ACCOUNT_${envId}_LABEL`] ?? id,
            apiKey,
            baseUrl: process.env[`FATHOM_ACCOUNT_${envId}_BASE_URL`],
        };
    });
}
function normalizeFathomAccount(account, index) {
    if (!account || typeof account !== "object" || Array.isArray(account)) {
        throw new Error(`FATHOM_ACCOUNTS[${index}] must be an object.`);
    }
    const candidate = account;
    const id = stringField(candidate, "id", index);
    const label = typeof candidate.label === "string" && candidate.label.trim() ? candidate.label.trim() : id;
    const apiKey = stringField(candidate, "apiKey", index);
    const baseUrl = typeof candidate.baseUrl === "string" && candidate.baseUrl.trim() ? candidate.baseUrl.trim() : undefined;
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
        throw new Error(`FATHOM_ACCOUNTS[${index}].id may only contain letters, numbers, underscores, and hyphens.`);
    }
    return { id, label, apiKey, baseUrl };
}
function stringField(candidate, field, index) {
    const value = candidate[field];
    if (typeof value !== "string" || !value.trim()) {
        throw new Error(`FATHOM_ACCOUNTS[${index}].${field} must be a non-empty string.`);
    }
    return value.trim();
}
function resolveDefaultAccountId(accounts) {
    if (process.env.FATHOM_DEFAULT_ACCOUNT?.trim()) {
        return process.env.FATHOM_DEFAULT_ACCOUNT.trim();
    }
    return accounts[0]?.id ?? "default";
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
        .trim()
        .split(/\s+/)
        .map((signature) => {
        const parts = signature.split(",");
        return (parts.length > 1 ? parts[1] : parts[0]).trim();
    })
        .some((signature) => timingSafeEqualString(expectedSignature, signature));
}
function headerValue(headers, name) {
    const normalizedName = name.toLowerCase();
    for (const [headerName, value] of Object.entries(headers)) {
        if (headerName.toLowerCase() !== normalizedName)
            continue;
        const firstValue = Array.isArray(value) ? value[0] : value;
        if (firstValue === undefined)
            continue;
        return firstValue.trim();
    }
    return undefined;
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
