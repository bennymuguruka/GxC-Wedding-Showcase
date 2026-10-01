import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";

const dynamodb = new DynamoDBClient({});

export const handler = async (
    event: { arguments: { code: string } },
) => {
    const { code } = event.arguments;

    if (!code || code !== code.trim() || Buffer.byteLength(code, "utf8") > 2048) {
        throw new Error("A valid invitation code is required");
    }

    const tableName = process.env.INVITATION_TABLE_NAME;
    const token = process.env.META_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const templateName = process.env.WHATSAPP_TEMPLATE_NAME;
    const language = process.env.WHATSAPP_TEMPLATE_LANGUAGE;

    if (!tableName || !token || !phoneNumberId || !templateName || !language) {
        throw new Error("WhatsApp sending is not configured");
    }

    const result = await dynamodb.send(new GetItemCommand({
        TableName: tableName,
        Key: { id: { S: code } },
        ConsistentRead: true,
        ProjectionExpression: "primaryGuestName, phoneNumber"
    }));

    const name = result.Item?.primaryGuestName?.S;
    const storedPhone = result.Item?.phoneNumber?.S;

    if (!name || !storedPhone) {
        throw new Error("Invitation or guest phone number missing");
    }

    let recipient = storedPhone.replace(/[\s()+-]/g, "");
    if (recipient.startsWith("00")) {
        recipient = recipient.slice(2);
    }
   if (/^0\d{9}$/.test(recipient)) {
    recipient = "27" + recipient.slice(1);
}

if (!/^[1-9]\d{7,14}$/.test(recipient)) {
    throw new Error("Use a valid phone number with its country code");
}

    const response = await fetch(
        `https://graph.facebook.com/v26.0/${phoneNumberId}/messages`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            signal: AbortSignal.timeout(15000),
            body: JSON.stringify({
                messaging_product: "whatsapp",
                to: recipient,
                type: "template",
                template: {
                    name: templateName,
                    language: { code: language },
                    components: [
                        {
                            type: "header",
                            parameters: [
                                {
                                    type: "image",
                                    image: {
                                        link: "https://www.example.com/whatsapp-invitation.png",
                                    },
                                },
                            ],
                        },
                        {
                            type: "body",
                            parameters: [{ type: "text", text: name }],
                        },
                        {
                            type: "button",
                            sub_type: "url",
                            index: "0",
                            parameters: [
                                { type: "text", text: encodeURIComponent(code) },
                            ],
                        },
                    ],
                },
            }),
        },
    );

    const payload = await response.json() as {
        messages?: { id: string }[];
        error?: { code?: number };
    };

    if (!response.ok || !payload.messages?.[0]?.id) {
        const errorCode = payload.error?.code ?? "unknown";
        throw new Error(`WhatsApp rejected the invitation (${errorCode})`);
    }

    return payload.messages[0].id;
};
