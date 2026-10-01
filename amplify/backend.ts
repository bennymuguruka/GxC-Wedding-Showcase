import { defineBackend } from "@aws-amplify/backend";
import { FunctionUrlAuthType } from "aws-cdk-lib/aws-lambda";
import { auth } from "./auth/resource";
import { data } from "./data/resource";
import { submitRsvp } from "./functions/submit-rsvp/resource";
import { lookupInvitation } from "./functions/lookup-invitation/resource";
import { sendInvitation } from "./functions/send-invitation/resource";
import { whatsappWebhook } from "./functions/whatsapp-webhook/resource";

const backend = defineBackend({
  auth,
  data,
  submitRsvp,
  lookupInvitation,
  sendInvitation,
  whatsappWebhook,
});

// Meta authenticates callbacks using the verify token and signed request body.
const whatsappWebhookUrl = backend.whatsappWebhook.resources.lambda.addFunctionUrl({
  authType: FunctionUrlAuthType.NONE,
});

backend.addOutput({
  custom: {
    whatsappWebhookUrl: whatsappWebhookUrl.url,
  },
});

const invitationTable = backend.data.resources.tables["Invitation"];

backend.sendInvitation.addEnvironment(
  "INVITATION_TABLE_NAME",
  invitationTable.tableName,
);

invitationTable.grant(
  backend.sendInvitation.resources.lambda,
  "dynamodb:GetItem",
);

backend.lookupInvitation.addEnvironment("INVITATION_TABLE_NAME", invitationTable.tableName);
invitationTable.grant(backend.lookupInvitation.resources.lambda, "dynamodb:GetItem");

backend.submitRsvp.addEnvironment(
  "INVITATION_TABLE_NAME",
  invitationTable.tableName,
);

invitationTable.grant(
  backend.submitRsvp.resources.lambda,
  "dynamodb:UpdateItem",
);
