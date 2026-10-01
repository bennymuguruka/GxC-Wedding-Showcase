// Fictional browser-only adapter. No network calls or persistent guest data.
let invitation = { primaryGuestName: "Taylor Example", maximumPartySize: 3, confirmedPartySize: 0, guestNames: [], rsvpStatus: "PENDING" };
export const client = {
 queries: { async lookupInvitation({code}) { return {data: code === "demo" ? {...invitation} : null}; } },
 mutations: { async submitRsvp({code, status, partySize, guestNames}) {
  if(code !== "demo" || !["ATTENDING", "DECLINED"].includes(status) || !Number.isInteger(partySize) || (status === "ATTENDING" && (partySize < 1 || partySize > invitation.maximumPartySize || guestNames.length !== partySize - 1 || guestNames.some(name => !name.trim()))) || (status === "DECLINED" && (partySize !== 0 || guestNames.length !== 0))) return {errors: [{message: "Invalid demo RSVP"}]};
  invitation = {...invitation, rsvpStatus: status, confirmedPartySize: partySize, guestNames};
  return {data: {success: true, ...invitation}};
 } }
};
