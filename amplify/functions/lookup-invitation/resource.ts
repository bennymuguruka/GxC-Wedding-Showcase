import { defineFunction } from "@aws-amplify/backend";

export const lookupInvitation = defineFunction({
  name: "lookup-invitation",
  entry: "./handler.ts",
  resourceGroupName: "data",
});
