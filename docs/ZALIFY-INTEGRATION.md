# Zalify headless integration

This demo shows how to add Zalify to a Shopify headless storefront without
replacing the storefront UI. It combines the Zalify CDN Pixel with the public
UniSubmit endpoint:

```text
Shopify storefront event
        ↓
PixelEvents → trackPixel → cdn.zalify.com/pixel.js
                                      ↓
                         analytics + configured ad forwarding

React form → UniSubmit → form_submitted / lead → CDN Pixel
```

## 1. Configure the workspace

Set the public workspace ID in [`theme/pixel.json`](../theme/pixel.json):

```json
{
  "workspaceId": "your-workspace-id"
}
```

Set the List ID used by the example forms in
[`lib/zalify-demo-config.ts`](../lib/zalify-demo-config.ts):

```ts
export const ZALIFY_DEMO_WORKSPACE_ID = 'your-workspace-id';
export const ZALIFY_DEMO_LIST_ID = 'your-list-id';
```

These are public storefront identifiers. Never put private Zalify API keys in
browser code.

## 2. Load the CDN Pixel

[`components/StoreLayout.tsx`](../components/StoreLayout.tsx) renders a queue
stub and loads the official CDN script:

```tsx
<script
  dangerouslySetInnerHTML={{
    __html:
      'window.zalify=window.zalify||function(){(zalify.q=zalify.q||[]).push(arguments)};',
  }}
/>
<script
  src={`https://cdn.zalify.com/pixel.js?wid=${encodeURIComponent(pixelWid)}`}
  defer
/>
```

The queue means events fired during hydration are retained until the script is
ready. The workspace ID comes from `theme/pixel.json`; if it is missing, the
Pixel script is not loaded.

## 3. Send storefront events

Use [`lib/pixel.ts`](../lib/pixel.ts) rather than calling the global directly:

```ts
trackPixel('product_viewed', {
  productVariant: {
    id: variant.id,
    price: {amount: 29.99, currencyCode: 'USD'},
    product: {id: product.id, title: product.title, vendor: product.vendor},
  },
});
```

[`components/theme/PixelEvents.tsx`](../components/theme/PixelEvents.tsx) is
the single event bridge for the demo. It tracks:

| Event | Trigger |
| --- | --- |
| `page_viewed` | Client-side route transitions; the CDN loader handles the initial page view |
| `product_viewed` | Product detail route receives a product resource |
| `collection_viewed` | Collection route receives a collection resource |
| `search_submitted` | Search results are rendered for a query |
| `product_added_to_cart` | Cart line quantity increases, including quick-add and drawer actions |
| `checkout_started` | The cart checkout link is clicked |
| `form_submitted` | A signup form passes local validation and begins UniSubmit |
| `lead` | UniSubmit returns any HTTP 2xx response |

The event bridge derives payloads from the existing Shopify Storefront API
objects and cart store. Do not add tracking calls to every product or cart
component; extend `PixelEvents` when a new global storefront event is needed.

## 4. Submit a headless form with UniSubmit

The custom forms in [`components/ZalifySignupForm.tsx`](../components/ZalifySignupForm.tsx)
call [`lib/zalify-unisubmit.ts`](../lib/zalify-unisubmit.ts). The browser
request is:

```ts
await fetch('https://reach.zalify.com/v1/public/unisubmit', {
  method: 'POST',
  credentials: 'omit',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    wid: workspaceId,
    identity: {email, first_name: firstName},
    submission: {
      form_key: 'shopify_demo_inline',
      provider: 'api',
      payload: {email, firstName, emailMarketingConsent},
    },
    subscribe: {
      list_id: listId,
      email_marketing_consent: emailMarketingConsent,
    },
    context: {page_url: window.location.href},
    idempotency_key: idempotencyKey,
  }),
});
```

Important contract rules:

- `provider: 'api'` requires `submission.form_key`.
- `submission.form_id` is for Zalify-hosted forms and popups using
  `provider: 'zalify'`.
- Fire `form_submitted` before the request and `lead` only after `response.ok`.
- Reuse the same idempotency key when retrying one logical submission.
- Reflect the user's real marketing consent in
  `email_marketing_consent`; never hard-code consent to `true`.
- Do not send credentials or private API keys from the storefront.

## 5. Advertising forwarding

The storefront only emits normalized Zalify events. Configured advertising
destinations are selected by the CDN Pixel for the workspace and receive the
events through its forwarding pipeline. This demo does not load separate ad
SDKs or duplicate event calls in React.

To verify forwarding locally:

1. Open the storefront with DevTools Network and Console enabled.
2. Confirm `pixel.js?wid=...` loads from `cdn.zalify.com`.
3. Navigate between the home, product, collection, and search routes.
4. Add a product to cart and click checkout.
5. Submit the inline and popup forms.
6. Confirm the Pixel event requests contain the expected event names and that
   the UniSubmit request returns 2xx.

Do not use a real customer's personal data while testing. Use a test address
and a test List where possible.

## 6. Run the demo

```sh
cp .env.example .env
pnpm install
pnpm dev
```

Open `http://localhost:3000`. The hosted demo uses the same integration at
<https://zalify-headless-unisubmit-demo.z1.shop>.
