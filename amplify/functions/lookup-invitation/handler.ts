import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import type { Schema } from "../../data/resource";

const dynamodb = new DynamoDBClient({});

export const handler: Schema["lookupInvitation"]["functionHandler"] = async (event) => {
  const { code } = event.arguments;
  if (typeof code !== "string" || !code.trim() || code !== code.trim() ||
      Buffer.byteLength(code, "utf8") > 2048) return null;

  const tableName = process.env.INVITATION_TABLE_NAME;
  if (!tableName) throw new Error("Invitation service is not configured");

  let invitation;
  try {
    const result = await dynamodb.send(new GetItemCommand({
      TableName: tableName,
      Key: { id: { S: code } },
      ConsistentRead: true,
      // Fetch only the fields exposed by this guest-safe operation.
      ProjectionExpression: "#name, #maximum, #confirmed, #guests, #status",
      ExpressionAttributeNames: {
        "#name": "primaryGuestName",
        "#maximum": "maximumPartySize",
        "#confirmed": "confirmedPartySize",
        "#guests": "guestNames",
        "#status": "rsvpStatus",
      },
    }));
    invitation = result.Item;
  } catch {
    throw new Error("Unable to look up invitation");
  }

  if (!invitation) return null;
  const primaryGuestName = invitation.primaryGuestName?.S;
  const maximumPartySize = Number(invitation.maximumPartySize?.N);
  if (!primaryGuestName || !Number.isInteger(maximumPartySize) ||
      maximumPartySize < 1 || maximumPartySize > 20) {
    throw new Error("Invalid invitation allocation");
  }
  return {
    primaryGuestName,
    maximumPartySize,
    confirmedPartySize: invitation.confirmedPartySize?.N == null
      ? null : Number(invitation.confirmedPartySize.N),
    guestNames: invitation.guestNames?.L?.map((name) => name.S ?? null) ?? [],
    rsvpStatus: invitation.rsvpStatus?.S ?? "PENDING",
  };
};
