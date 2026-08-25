# Zalify Shopify Headless Demo Design

## Goal

Turn the generated Shopify headless storefront into an open-source verification project that demonstrates Zalify pixel commerce tracking plus merchant-owned inline and popup forms calling the public UniSubmit API.

## Architecture

The generated Next.js storefront remains the Shopify commerce shell. A small client-side integration layer owns the UniSubmit request contract and event ordering; reusable form state is shared by the inline form and popup. The server-rendered store layout continues to load the Zalify pixel from `theme/pixel.json`, while the home page mounts the demonstration UI without changing product, cart, or checkout code.

## Integration contract

- Pixel workspace ID is stored in `theme/pixel.json`.
- Forms call `POST https://reach.zalify.com/v1/public/unisubmit` directly from the browser.
- Merchant-owned forms send `submission.form_id` and `submission.provider: "api"`.
- `form_submitted` fires before the request; `lead` fires only after a 2xx response.
- `credentials: "omit"`, no bearer token, and a stable idempotency key are required.
- The List ID is configurable with `NEXT_PUBLIC_ZALIFY_LIST_ID`; the UI remains usable when it is not configured and reports the missing setting instead of sending an invalid request.

## UI

The home page gets a compact demo card with an inline newsletter form and a button that opens the same form in a modal popup. Both paths use the same client request helper and display idle, submitting, success, and error states. A small event activity list shows the locally observed `form_submitted` and `lead` events so developers can verify ordering while testing.

## Verification

Run typecheck and production build. Start the dev server against the generated Shopify environment, submit the inline form and popup form with a configured List ID, and verify the browser Network panel shows the UniSubmit request and the pixel event calls. Commerce behavior remains covered by the generated app build.
