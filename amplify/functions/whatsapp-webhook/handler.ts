import { createHmac, timingSafeEqual } from "node:crypto";

type WebhookEvent = {
    requestContext: { http: { method: string } };
    headers?: Record<string, string | undefined>;
    queryStringParameters?: Record<string, string | undefined>;
    body?: string | null;
    isBase64Encoded?: boolean;
};

function response(statusCode: number, body: string) {
    return {
        statusCode,
        headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-store",
        },
        body,
    };
}

function equalSecret(actual: string, expected: string) {
    const actualBytes = Buffer.from(actual);
    const expectedBytes = Buffer.from(expected);
    return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

function asRecord(value: unknown): Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
        ? value as Record<string, unknown> : {};
}

export const handler = async (event: WebhookEvent) => {
    const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;
    const appSecret = process.env.META_APP_SECRET;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!verifyToken || !appSecret || !phoneNumberId) {
        return response(503, "Webhook is not configured");
    }

    const method = event.requestContext.http.method;
    if (method === "GET") {
        const query = event.queryStringParameters ?? {};
        if (query["hub.mode"] !== "subscribe" || !query["hub.challenge"] ||
            !equalSecret(query["hub.verify_token"] ?? "", verifyToken)) {
            return response(403, "Verification failed");
        }
        return response(200, query["hub.challenge"]);
    }
    if (method !== "POST") return response(405, "Method not allowed");

    const signature = Object.entries(event.headers ?? {}).find(
        ([name]) => name.toLowerCase() === "x-hub-signature-256"
    )?.[1];
    if (!signature || !/^sha256=[a-f\d]{64}$/i.test(signature)) {
        return response(403, "Invalid signature");
    }
    const rawBody = Buffer.from(event.body ?? "", event.isBase64Encoded ? "base64" : "utf8");
    const expectedSignature = createHmac("sha256", appSecret).update(rawBody).digest();
    const receivedSignature = Buffer.from(signature.slice(7), "hex");
    if (!timingSafeEqual(receivedSignature, expectedSignature)) {
        return response(403, "Invalid signature");
    }

    let payload: Record<string, unknown>;
    try {
        payload = asRecord(JSON.parse(rawBody.toString("utf8")));
    } catch {
        return response(400, "Invalid JSON");
    }
    if (payload.object !== "whatsapp_business_account") {
        return response(404, "Unsupported webhook object");
    }
    for (const entry of Array.isArray(payload.entry) ? payload.entry : []) {
        const changes = asRecord(entry).changes;
        for (const change of Array.isArray(changes) ? changes : []) {
            const changeRecord = asRecord(change);
            const value = asRecord(changeRecord.value);
            if (changeRecord.field !== "messages" ||
                asRecord(value.metadata).phone_number_id !== phoneNumberId) continue;
            for (const item of Array.isArray(value.statuses) ? value.statuses : []) {
                const status = asRecord(item);
                if (typeof status.id !== "string" || typeof status.status !== "string" ||
                    !["sent", "delivered", "read", "failed"].includes(status.status)) continue;
                // Log only status metadata, never the full payload, tokens or guest details.
                console.info("WhatsApp delivery status", {
                    messageId: status.id,
                    status: status.status,
                    timestamp: typeof status.timestamp === "string" ? status.timestamp : undefined,
                    errorCodes: (Array.isArray(status.errors) ? status.errors : [])
                        .map((error) => asRecord(error).code)
                        .filter((code): code is number => typeof code === "number"),
                });
            }
        }
    }
    return response(200, "EVENT_RECEIVED");
};
