import {
    DynamoDBClient,
    UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import type { Schema } from "../../data/resource";

const dynamodb = new DynamoDBClient({});

export const handler: Schema["submitRsvp"]["functionHandler"] = async (
    event,
) => {
    const { code, status, partySize, guestNames } = event.arguments;

    const tableName = process.env.INVITATION_TABLE_NAME;

    if (!tableName) {
        throw new Error("RSVP service is not configured");
    }

    if (
        typeof code !== "string" ||
        !code.trim() ||
        code !== code.trim() ||
        Buffer.byteLength(code, "utf8") > 2048
    ) {
        throw new Error("A valid invitation code is required");
    }

    if (status !== "ATTENDING" && status !== "DECLINED") {
        throw new Error("Choose ATTENDING or DECLINED");
    }

    if (!Number.isSafeInteger(partySize) || partySize < 0) {
        throw new Error("Party size must be a non-negative whole number");
    }

    if (status === "ATTENDING" && partySize === 0) {
        throw new Error("Please include at least one attending guest");
    }

    if (status === "DECLINED" && partySize !== 0) {
        throw new Error("A declined RSVP must have zero guests");
    }

    const expectedGuestNames =
        status === "ATTENDING" ? partySize - 1 : 0;

    if (
        !Array.isArray(guestNames) ||
        guestNames.length !== expectedGuestNames ||
        guestNames.some(
            (name) => typeof name !== "string" || !name.trim(),
        )
    ) {
        throw new Error(
            "Provide one non-empty name for each additional guest",
        );
    }

    const names = guestNames.map((name) => name.trim());

    const command = new UpdateItemCommand({
        TableName: tableName,
        Key: {
            id: { S: code },
        },

        ConditionExpression:
            status === "ATTENDING"
                ? "attribute_exists(#id) AND #maximumPartySize >= :size"
                : "attribute_exists(#id)",

        UpdateExpression:
            "SET #status = :status, #size = :size, " +
            "#names = :names, #updatedAt = :updatedAt",

        ExpressionAttributeNames: {
            "#id": "id",
            "#status": "rsvpStatus",
            "#size": "confirmedPartySize",
            "#names": "guestNames",
            "#updatedAt": "updatedAt",
            ...(status === "ATTENDING"
                ? { "#maximumPartySize": "maximumPartySize" }
                : {}),
        },

        ExpressionAttributeValues: {
            ":status": { S: status },
            ":size": { N: String(partySize) },
            ":names": {
                L: names.map((name) => ({ S: name })),
            },
            ":updatedAt": { S: new Date().toISOString() },
        },

        ReturnValues: "UPDATED_NEW",
    });

    let result;

    try {
        result = await dynamodb.send(command);
    } catch (error) {
        if (
            error instanceof Error &&
            error.name === "ConditionalCheckFailedException"
        ) {
            throw new Error(
                "Invitation not found or party size exceeds your seat allocation",
            );
        }

        throw new Error("Unable to save your RSVP. Please try again.");
    }

    const saved = result.Attributes;
    const savedNames = saved?.guestNames?.L?.map((name) => name.S);

    if (
        saved?.rsvpStatus?.S !== status ||
        saved?.confirmedPartySize?.N !== String(partySize) ||
        !savedNames ||
        savedNames.length !== names.length ||
        savedNames.some((name, index) => name !== names[index])
    ) {
        throw new Error("Unable to confirm your saved RSVP. Please try again.");
    }

    return {
        success: true,
        rsvpStatus: status,
        confirmedPartySize: partySize,
        guestNames: names,
    };
};
