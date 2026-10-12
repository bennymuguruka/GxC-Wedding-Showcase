# GxC Wedding Showcase

A wedding invitation and RSVP portfolio project built with vanilla JavaScript, Vite, and AWS Amplify Gen 2. The guest experience combines a responsive invitation, event details, a live countdown, and a two-step RSVP form. A separate admin dashboard provides invitation reporting, WhatsApp sending, and seating assignments when connected to a deployed backend.

The included demo features fictional event details for **Alex & Jordan**. It runs in the browser with sample guest data; AWS and Meta accounts are only needed to connect the cloud features.

For access to the full repository, please reach out to [@bennymuguruka](https://github.com/bennymuguruka).

## Preview

[Watch the design preview video](images/WhatsApp%20Video%202026-10-12%20at%2006.37.37.mp4)

![Invitation artwork](images/IMG_1834.jpeg)

## Features

### Guest invitation

- Responsive layout with event details, a countdown, a wedding-day schedule, and a dress palette.
- Invitation access through a `?code=` link, with missing and invalid invitation states.
- Two-step RSVP flow for accepting or declining an invitation.
- Party-size limits and required names for additional guests.
- Gift information, FAQs, and a demo privacy page.

### Admin dashboard and backend

- Email sign-in with access restricted to the Cognito `ADMINS` group.
- RSVP overview, searchable and sortable invitation records, and batch WhatsApp invitation sending with confirmation.
- Seating-table creation, assignment of confirmed parties, and remaining-seat counts.
- Guest lookup and RSVP functions backed by DynamoDB, including server-side RSVP validation.
- WhatsApp callback verification and signed webhook payload validation.

The admin dashboard requires your own deployed Amplify backend. The browser demo covers the guest invitation and RSVP flow only.

## Run locally

Use **Node.js 22.12.0 or newer** and npm. The included Amplify build configuration uses Node.js 24.

```sh
git clone https://github.com/bennymuguruka/GxC-Wedding-Showcase.git
cd GxC-Wedding-Showcase
npm ci
```

Create a local placeholder configuration. This command preserves an existing `amplify_outputs.json`:

```sh
node -e "const fs = require('node:fs'); if (!fs.existsSync('amplify_outputs.json')) fs.copyFileSync('amplify_outputs.example.json', 'amplify_outputs.json');"
npm run dev
```

Open the local URL printed by Vite and append `/?code=demo` to the origin, for example `http://localhost:5173/?code=demo` when Vite uses port 5173.

The demo invitation belongs to **Taylor Example** and allows up to **three guests**, including the primary guest. Try accepting or declining, changing the party size, and entering fictional names for additional guests. Responses stay in JavaScript memory and reset when the page reloads. Other invitation codes show the invalid invitation state; opening the page without a code shows the invitation landing screen.

The placeholder configuration is an empty JSON object that lets Vite bundle the admin entry point. It does not enable admin sign-in or connect to AWS. The guest demo sends no RSVP data to AWS or Meta; the invitation page still loads Google Fonts.

## Build and preview

With the local configuration file in place:

```sh
npm run build
npm run preview
```

The build writes to `dist/` and includes the guest page and `/admin/` entry point. Append `/?code=demo` to the preview server's origin to open the guest demo.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server. |
| `npm run build` | Bundle the guest and admin frontends. |
| `npm run preview` | Serve the built frontend locally. |
| `npm run sandbox` | Provision and run an Amplify development backend using your AWS credentials. |

## Connect your own backend

The repository includes backend definitions and integration code. Connecting them requires AWS credentials, an Amplify environment, and Meta WhatsApp configuration. Running the sandbox provisions AWS resources that may incur charges.

1. **Configure the backend secrets.** Set the Amplify secrets named `meta_access_token`, `meta_webhook_verify_token`, and `meta_app_secret`. Their references live in the [send-invitation resource](amplify/functions/send-invitation/resource.ts) and [webhook resource](amplify/functions/whatsapp-webhook/resource.ts). `.env.example` documents variable names; copying it to `.env` does not configure Amplify secrets.
2. **Update WhatsApp settings.** Replace `REPLACE_WITH_META_PHONE_NUMBER_ID` in both resources. Set the sender's template name and language, and replace the placeholder image URL in the [send handler](amplify/functions/send-invitation/handler.ts). The message payload expects an approved template with an image header, a guest-name body parameter, and a URL button whose variable suffix is the invitation code.
3. **Start the backend.** With your AWS credentials configured, run `npm run sandbox`. Use the generated `amplify_outputs.json` in place of the empty demo placeholder. This file is ignored by Git.
4. **Set up admin access and invitation records.** Create a Cognito account with completed account setup and membership in `ADMINS`, then visit `/admin/`. Load invitation records through your backend tooling; the dashboard has no invitation creation or import form. [Example records](examples/invitations.json) show the data shape and are not imported automatically. Their phone numbers are deliberately invalid.
5. **Connect the guest page.** Replace the demo-client import at the top of `script.js` with the initialization below. The existing lookup and RSVP calls already request `identityPool` authorization. Invitation links use `?code=<invitation-id>`.
6. **Connect the webhook.** Use `custom.whatsappWebhookUrl` from the generated backend outputs as the Meta callback URL, with the verification token you configured. Match the template's invitation URL to your deployed guest page.

Guest client initialization for a deployed backend:

```js
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import outputs from "./amplify_outputs.json";

Amplify.configure(outputs);
const client = generateClient({ authMode: "identityPool" });
```

The [Amplify build configuration](amplify.yml) includes backend deployment and frontend build steps for Amplify Hosting. Connecting the repository to hosting alone does not replace the secret, template, account, and guest-client setup above.

## Project structure

| Path | Purpose |
| --- | --- |
| `index.html`, `styles.css`, `script.js` | Guest invitation, countdown, and RSVP interface. |
| `demo-client.js` | Browser-only sample invitation and RSVP state. |
| `admin/` | Admin sign-in, reporting, invitation sending, and seating UI. |
| `amplify/auth/` | Cognito email sign-in and admin group configuration. |
| `amplify/data/` | Invitation and seating-table models, authorization, and custom operations. |
| `amplify/functions/` | Lookup, RSVP, invitation sending, and webhook handlers. |
| `amplify/backend.ts` | Resource wiring, permissions, and webhook output. |
| `examples/invitations.json` | Fictional backend record examples. |
| `images/` | Invitation artwork, schedule icons, and preview video. |
| `public/privacy-policy.html` | Demo privacy information. |
| `vite.config.js` | Guest and admin build entry points. |
| `amplify.yml` | Amplify Hosting build configuration. |

Guest operations expose invitation details and accept RSVP responses without granting direct model access. Invitation codes act as bearer links: anyone with a valid code can access that invitation and submit its response. Direct invitation and seating-table model access is restricted to `ADMINS`.

## Customize the invitation

- Update names, venue, displayed date, schedule, FAQs, and gift details in `index.html`.
- Keep the countdown date in `script.js` aligned with the event date and timezone.
- Adjust typography, colors, and layout in `styles.css`, and replace artwork in `images/`.
- Edit `demo-client.js` to change the fictional guest and party allocation used by the local demo.
- Replace the style-inspiration and registry placeholder links before using them for an event.
- Update the privacy page to reflect your actual data handling when connecting a backend.

## Current limitations

- Demo RSVP responses are temporary, and the admin dashboard has no local demo adapter.
- WhatsApp sending returns a message ID but does not persist send timestamps or delivery state. The webhook verifies and logs delivery events without updating invitation records.
- Seating capacity is checked in the admin UI; concurrent assignments are not protected by a server-side capacity check.
- The dashboard does not provide invitation creation, import, editing, deletion, or reminder sending. It also has no table-edit or table-delete controls.
- The admin sign-in form does not complete additional authentication challenges such as password changes or MFA.
- A successful frontend build does not verify the deployed AWS and Meta integrations. No automated test command is currently defined in `package.json`.

Use fictional data when trying the showcase. Local secrets, generated Amplify configuration, dependency folders, and build output are excluded through [`.gitignore`](.gitignore).
