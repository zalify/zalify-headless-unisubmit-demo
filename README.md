# Zalify CDN Pixel headless event lab

This repository is a deliberately small, standalone **Next.js 16 App Router**
project. It demonstrates the browser-side integration pattern for a
headless Shopify storefront:

```text
storefront interaction
        ↓
trackPixel(event, properties)
        ↓
window.zalify('track', event, properties)
        ↓
Zalify CDN Pixel
        ↓
analytics + advertising destinations configured for the workspace
```

There is no Shopify theme, Storefront API client, cart framework, or remote
form UI in this project. The page contains buttons that produce realistic
payloads, so a developer or coding AI can inspect the integration without
first understanding a complete commerce application.

## What this demo answers

A headless storefront developer normally needs to know:

- How do I load Zalify Pixel in a Next.js application?
- What function should my React components call?
- Which events should fire when a page, product, collection, search, cart, or
  checkout changes?
- How can two forms share one List, or send to different Lists?
- When should `form_submitted` and `lead` be sent around UniSubmit?
- How do advertising integrations receive the same events?

The implementation and the event controls on the home page answer these
questions with working TypeScript examples.

## Quick start

Requirements: Node.js 20.9 or newer and pnpm.

```sh
git clone https://github.com/zalify/zalify-headless-unisubmit-demo.git
cd zalify-headless-unisubmit-demo
pnpm install
pnpm dev
```

Open <http://localhost:3000>. Click any event button and inspect the **Event
activity** panel. The same call is sent to the CDN Pixel and recorded in the
local panel; the panel is only a debugging aid and is not the source of truth.

Production commands:

```sh
pnpm run typecheck   # TypeScript without emitting files
pnpm run build       # Next.js production build
pnpm start           # Serve the last production build
```

## Configure a Zalify workspace

The demo uses public identifiers only. Set them in `.env`:

```sh
NEXT_PUBLIC_ZALIFY_WORKSPACE_ID=your-workspace-id
NEXT_PUBLIC_ZALIFY_LIST_ID=your-list-id
```

If the variables are unset, [`lib/config.ts`](lib/config.ts) uses the public
demo defaults. The workspace ID is passed to the CDN loader. The List IDs are
only used in the example form event payloads.

Do not put a Zalify admin token, private API key, or server secret in a
`NEXT_PUBLIC_*` variable. Pixel and UniSubmit are public browser endpoints;
authentication is not added to these requests.

## How the CDN Pixel is loaded

[`app/layout.tsx`](app/layout.tsx) does two things before rendering the page:

1. Installs a small `window.zalify` queue stub.
2. Loads the official Pixel script with the workspace ID.

```tsx
<script
  dangerouslySetInnerHTML={{
    __html:
      'window.zalify=window.zalify||function(){(zalify.q=zalify.q||[]).push(arguments)};',
  }}
/>
<script
  src={`https://cdn.zalify.com/pixel.js?wid=${encodeURIComponent(workspaceId)}`}
  defer
/>
```

The queue is important in a React application: components can emit an event
during hydration before the deferred Pixel script has finished downloading.
Once the script is ready, queued calls are consumed by the real Pixel runtime.

To disable Pixel locally, remove the loader from `app/layout.tsx` or provide a
conditional around the script. Do not replace it with a second ad SDK loader.

## The `trackPixel` adapter

[`lib/pixel.ts`](lib/pixel.ts) is the only module that knows about the global
`window.zalify` function:

```ts
export function trackPixel(
  event: string,
  properties?: Record<string, unknown>,
): void {
  if (typeof window === 'undefined') return;
  window.zalify?.('track', event, properties);
}
```

Components should import `trackPixel` instead of calling `window.zalify`
directly. This keeps server rendering safe, gives the project one place to
type the browser boundary, and preserves the queue behavior.

The optional `setPixelProperty(key, value)` helper is used for persistent
properties that should accompany later events.

## Event catalogue

[`components/PixelPlayground.tsx`](components/PixelPlayground.tsx) is the
copyable reference implementation. It exposes these controls:

| Event | When to send it | Example top-level payload |
| --- | --- | --- |
| `page_viewed` | Initial document view and client-side route changes | `{page: {url, path, title}}` |
| `product_viewed` | A product detail page becomes visible | `{productVariant: {id, price, product}}` |
| `collection_viewed` | A collection/listing page becomes visible | `{collection: {id, title, handle}}` |
| `search_submitted` | A shopper submits a search query | `{searchResult: {query}}` |
| `product_added_to_cart` | A cart line is added or its quantity increases | `{cartLine: {quantity, merchandise}}` |
| `checkout_started` | The shopper clicks the checkout action | `{checkout: {token, currencyCode, totalPrice}}` |
| `form_submitted` | A valid form starts its network submission | `{form_id, list_id, email}` |
| `lead` | UniSubmit returns an HTTP 2xx response | `{email}` |

### Page views and SPA navigation

The CDN loader can record the initial document view. A headless Next.js app
does not reload the document for client-side navigation, so route changes must
emit another `page_viewed` event. If your own router already sends a page view,
choose one owner to avoid duplicates.

### Product and collection views

Use IDs from the Storefront API rather than display names alone. A product
variant payload should include the selected variant and its parent product:

```ts
trackPixel('product_viewed', {
  productVariant: {
    id: variant.id,
    image: {src: variant.image?.url ?? ''},
    price: {amount: Number(variant.price.amount), currencyCode: 'USD'},
    sku: variant.sku ?? null,
    title: variant.title,
    product: {
      id: product.id,
      title: product.title,
      vendor: product.vendor,
    },
  },
});
```

### Cart and checkout

Send the quantity added, not the entire post-action cart quantity, for
`product_added_to_cart`. For `checkout_started`, send the current cart totals
and line items at the moment the checkout action is clicked.

```ts
trackPixel('product_added_to_cart', {
  cartLine: {
    quantity: 1,
    merchandise: {
      id: variant.id,
      product: {id: product.id, title: product.title, vendor: product.vendor},
    },
  },
});

trackPixel('checkout_started', {
  checkout: {
    token: cart.token,
    currencyCode: 'USD',
    totalPrice: {amount: 49, currencyCode: 'USD'},
  },
});
```

## Forms, UniSubmit, and Lists

The demo has two form buttons to make List routing visible:

- `newsletter` → the shared configured List ID
- `vip_waitlist` → a separate example List ID

In a real application, the event's `list_id` and the UniSubmit request's
`subscribe.list_id` must agree. Multiple forms can share one List by using the
same ID; separate forms can target different Lists by using different IDs.

### UniSubmit request

For a merchant-owned headless form, use `provider: "api"` and **
`submission.form_key`**:

```ts
const response = await fetch(
  'https://reach.zalify.com/v1/public/unisubmit',
  {
    method: 'POST',
    credentials: 'omit',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      wid: workspaceId,
      identity: {
        email,
        first_name: firstName,
      },
      submission: {
        form_key: 'newsletter',
        provider: 'api',
        payload: {
          email,
          firstName,
          emailMarketingConsent,
        },
      },
      subscribe: {
        list_id: listId,
        email_marketing_consent: emailMarketingConsent,
      },
      context: {page_url: window.location.href},
      idempotency_key: `newsletter:${crypto.randomUUID()}`,
    }),
  },
);
```

The required event order is:

```text
local validation succeeds
        ↓
trackPixel('form_submitted', ...)
        ↓
POST UniSubmit
        ↓
response.ok === true
        ↓
trackPixel('lead', ...)
```

Rules:

- `provider: "api"` requires `submission.form_key`.
- `submission.form_id` is reserved for Zalify-hosted forms using
  `provider: "zalify"`.
- Treat every HTTP 2xx as success; do not require a response JSON shape.
- Reuse the same idempotency key when retrying one logical submission.
- Send the user's actual marketing consent; never force it to `true`.
- Keep passwords, payment details, tokens, and unrelated sensitive fields out
  of `submission.payload`.

## Advertising event forwarding

The browser integration emits normalized Zalify events only. The CDN Pixel
associates those events with the configured workspace and forwards supported
events to the advertising destinations enabled for that workspace. This repo
does not load separate Meta, Google, TikTok, or other ad SDKs and does not
duplicate their calls in React.

That separation matters: storefront code owns the event timing and payload,
while the CDN Pixel owns destination-specific mapping, delivery, and any
workspace-level advertising configuration.

## Verify with browser DevTools

Run the app and open Chrome DevTools:

1. In **Network**, confirm `https://cdn.zalify.com/pixel.js?wid=...` loads.
2. In **Console**, type `typeof window.zalify`; it should be `function`.
3. Click each event button and compare the Event activity panel with Pixel
   network requests.
4. For a real UniSubmit form, confirm the request has
   `submission.form_key` and `provider: "api"`.
5. Confirm `form_submitted` happens before the request and `lead` happens only
   after a successful 2xx response.
6. Check the Zalify workspace event stream and configured ad destination
   diagnostics after allowing normal delivery time.

Use test addresses and test Lists. Do not submit real customer data while
debugging.

## Project structure

```text
app/layout.tsx                 CDN Pixel queue + script loader
app/page.tsx                   the single demo route
app/globals.css                intentionally small demo styles
components/PixelPlayground.tsx event buttons + local event log
lib/pixel.ts                   typed window.zalify adapter
lib/config.ts                  public workspace/List defaults
docs/ZALIFY-INTEGRATION.md     focused integration reference
```

## Adapting this example to a real storefront

1. Copy `lib/pixel.ts` into the storefront and keep its public function shape.
2. Add the queue stub and CDN script to the root layout once.
3. Replace the demo buttons with calls from your router, product loader, cart
   store, search handler, and checkout link.
4. Keep commerce payload construction in one event bridge so fields stay
   consistent across product cards, PDPs, quick-add, and cart drawers.
5. Add UniSubmit to your existing form handler without replacing your current
   validation or UI states.
6. Test every event in DevTools and in the Zalify workspace event stream before
   enabling production advertising destinations.

For the short request-contract reference, see
[`docs/ZALIFY-INTEGRATION.md`](docs/ZALIFY-INTEGRATION.md).
