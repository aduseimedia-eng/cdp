# CGN Events registration page

A responsive CDP registration website and admin dashboard built with plain HTML, CSS, and JavaScript.

## Preview

Open `index.html` for the programme page, `register.html` for the focused registration and payment flow, and `admin.html` for the dashboard. No build step is required.

The prototype uses browser `localStorage`, so admin changes and registrations are shared only between pages opened in the same browser and on the same origin. Use a local web server rather than opening the files separately if the browser restricts storage for `file://` pages.

## Admin dashboard

An authenticated administrator can change the initial dashboard password from the Security page. Only its SHA-256 hash is saved in the browser; the plain-text password is never stored in the project or browser storage.

The dashboard can:

- Edit the programme title, edition, description, date, time, venue, and fee
- Upload and remove the programme poster
- Open or close registration
- Show or hide the poster, event details, and fee
- Change payment instructions
- Review registrations, mark payments as pending or verified, search, and export CSV

## Replace before publishing

Search the project for these demo values and replace them with the company's real information:

- `CGN Events` / `CGN EVENTS`
- `Business Growth Masterclass`
- `22 August 2026`
- `GHS 250`
- `024 000 0000` and `+233 24 000 0000`
- `hello@cgnevents.com`
- The schedule, refund wording, replay policy, and programme description

## Production integration

The current submit action saves a front-end demonstration record in browser storage. It does not prove that payment was verified or send a real WhatsApp message.

A secure production flow should be:

1. The browser sends the participant and payment-reference data to `POST /api/registrations` over HTTPS.
2. The server validates and stores the record, generating the registration reference on the server.
3. Payment is verified with the payment provider or by an administrator. Do not trust a transaction ID or uploaded screenshot by itself.
4. After verification, a background job sends an approved WhatsApp template through the Meta WhatsApp Cloud API (or another official business provider).
5. The message contains the programme link or, preferably, a short-lived signed access link tied to that participant.

Recommended safeguards:

- Make transaction IDs unique and make webhook processing idempotent.
- Keep API credentials and WhatsApp tokens only on the server.
- Rate-limit registration and upload endpoints.
- Store receipts in private object storage with short-lived access URLs.
- Restrict receipt images by actual file type and size on the server.
- Publish a privacy notice and define how long participant data is retained.
- Keep a message-delivery log and a manual resend option for support staff.
- Protect `admin.html` with server-side authentication and role-based access. Hiding or password-protecting it with front-end JavaScript is not secure.
- Store programme configuration and registrations in a database rather than `localStorage`.

The integration point is documented in the submit handler in `app.js`.
