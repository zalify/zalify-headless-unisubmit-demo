# Zalify CDN Pixel headless event lab

Minimal Next.js 16 App Router project showing how a headless storefront sends
commerce events to Zalify CDN Pixel. It intentionally does not include a
Shopify theme, Storefront API client, or commerce framework.

## Run locally

```sh
pnpm install
pnpm dev
```

Open <http://localhost:3000>. The page has buttons for page, product,
collection, search, add-to-cart, checkout, and form events. Each click both
calls CDN Pixel and adds a readable entry to the local event log.

## Configure Pixel

Set the public workspace ID in `NEXT_PUBLIC_ZALIFY_WORKSPACE_ID` (or update the
fallback in `lib/config.ts`). The root layout loads:

```text
https://cdn.zalify.com/pixel.js?wid=<workspace-id>
```

The queue stub is installed before the deferred script, so events are safe to
send during hydration.

## Event API

`lib/pixel.ts` exposes the only browser boundary:

```ts
trackPixel('product_viewed', {productVariant: {...}});
trackPixel('product_added_to_cart', {cartLine: {...}});
trackPixel('checkout_started', {checkout: {...}});
```

Use `components/PixelPlayground.tsx` as a copyable reference when integrating
the same calls into a real headless storefront. Zalify CDN Pixel handles
analytics and forwards normalized events to advertising destinations configured
for the workspace; this demo does not load separate ad SDKs.

## Forms and Lists

The form buttons demonstrate that multiple forms can use one List or separate
Lists by including the List ID in each event payload. For real contact capture,
call the public UniSubmit endpoint and use:

```json
{
  "submission": {
    "form_key": "newsletter",
    "provider": "api",
    "payload": {"email": "test@example.com"}
  }
}
```

Send `form_submitted` before UniSubmit and `lead` only after an HTTP 2xx.
See [docs/ZALIFY-INTEGRATION.md](docs/ZALIFY-INTEGRATION.md) for the full
request contract and verification checklist.

## Project structure

```text
app/layout.tsx              CDN Pixel loader and global metadata
app/page.tsx                single demo route
components/PixelPlayground  event buttons and local event log
lib/pixel.ts                typed window.zalify adapter
lib/config.ts               public workspace/List defaults
docs/ZALIFY-INTEGRATION.md  integration guide for AI and developers
```
