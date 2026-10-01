import { defineFunction, secret } from "@aws-amplify/backend";

export const whatsappWebhook = defineFunction({
    name: "whatsapp-webhook",
    entry: "./handler.ts",
    resourceGroupName: "data",
    environment: {
        META_WEBHOOK_VERIFY_TOKEN: secret("meta_webhook_verify_token"),
        META_APP_SECRET: secret("meta_app_secret"),
        WHATSAPP_PHONE_NUMBER_ID: "REPLACE_WITH_META_PHONE_NUMBER_ID",
    },
});
