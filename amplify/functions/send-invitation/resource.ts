import {defineFunction, secret} from "@aws-amplify/backend";

export const sendInvitation = defineFunction({
    name: "send-invitation",
    timeoutSeconds: 30,
    entry: "./handler.ts",
    resourceGroupName: "data",
    environment: {
        META_ACCESS_TOKEN: secret("meta_access_token"),
        WHATSAPP_PHONE_NUMBER_ID: "REPLACE_WITH_META_PHONE_NUMBER_ID",
        WHATSAPP_TEMPLATE_NAME: "wedding_invitation_demo",
        WHATSAPP_TEMPLATE_LANGUAGE: "en"
    }
});