import { a, defineData, type ClientSchema } from "@aws-amplify/backend";
import { lookupInvitation } from "../functions/lookup-invitation/resource";
import { submitRsvp } from "../functions/submit-rsvp/resource";
import { sendInvitation } from "../functions/send-invitation/resource";

const schema = a
  .schema({
    Invitation: a
      .model({
        primaryGuestName: a.string().required(),
        phoneNumber: a.string().required(),
        maximumPartySize: a.integer().required(),

        confirmedPartySize: a.integer(),
        guestNames: a.string().array(),
        rsvpStatus: a.enum(["PENDING", "ATTENDING", "DECLINED"]),

        invitationSentAt: a.datetime(),
        reminderSentAt: a.datetime(),
        whatsappDeliveryStatus: a.string(),
        seatingTableId: a.id(),
      })
      .authorization((allow) => [allow.group("ADMINS")]),

    SeatingTable: a
      .model({
        name: a.string().required(),
        capacity: a.integer().required(),
      })
      .authorization((allow) => [allow.group("ADMINS")]),

    InvitationLookupResult: a.customType({
      primaryGuestName: a.string().required(),
      maximumPartySize: a.integer().required(),
      confirmedPartySize: a.integer(),
      guestNames: a.string().array(),
      rsvpStatus: a.string().required(),
    }),

    RsvpResponse: a.enum(["ATTENDING", "DECLINED"]),

    RsvpSubmissionResult: a.customType({
      success: a.boolean().required(),
      rsvpStatus: a.ref("RsvpResponse").required(),
      confirmedPartySize: a.integer().required(),
      guestNames: a.string().required().array().required(),
    }),

    sendInvitation: a
      .mutation()
      .arguments({
        code: a.id().required(),
      })
      .returns(a.string())
      .authorization((allow) => [allow.group("ADMINS")])
      .handler(a.handler.function(sendInvitation)),

    submitRsvp: a.mutation().arguments({
      code: a.id().required(),
      status: a.ref("RsvpResponse").required(),
      partySize: a.integer().required(),
      guestNames: a.string().required().array().required(),
    })
      .returns(a.ref("RsvpSubmissionResult"))
      .authorization((allow) => [allow.guest()])
      .handler(a.handler.function(submitRsvp)),

    lookupInvitation: a
      .query()
      .arguments({
        code: a.id().required(),
      })
      .returns(a.ref("InvitationLookupResult"))
      .authorization((allow) => [allow.guest()])
      .handler(a.handler.function(lookupInvitation)),
  });

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "userPool",
  },
});
