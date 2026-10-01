import { defineFunction } from "@aws-amplify/backend";

export const submitRsvp = defineFunction({
    name: "submit-rsvp",
    entry: "./handler.ts",
    resourceGroupName: "data",
});