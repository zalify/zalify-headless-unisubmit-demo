# Zalify Theme Mirror — Next.js Edition

The third implementation of the Zalify theme: a **Next.js 16 (App
Router, React 19, blocking SSR) storefront** driven by the same JSON schema, CSS, and
shared React components that power `apps/hydrogen`. The Liquid theme
(`apps/liquid`) stays the canonical source — see the repo root README
and `apps/hydrogen/docs/THEME-MIRROR.md` for the architecture.

## Run it

```sh
pnpm install            # repo root
pnpm --filter @zalify/nextjs dev
```

No configuration needed: without env vars the storefront talks to
**https://mock.shop/api** (Shopify's demo Storefront API, no token).
To point at a real store, copy `.env.example` to `.env` and set:

```
NEXT_PUBLIC_STORE_DOMAIN=your-store.myshopify.com
NEXT_PUBLIC_STOREFRONT_API_TOKEN=<public storefront token>
```

Other scripts: `pnpm build`, `pnpm start`, `pnpm typecheck`.

## Your theme data lives in `theme/`

A standalone (scaffolded) project customizes the theme through the
merchant-owned `theme/` folder — `settings_data.json`,
`templates/*.json`, `templates/customers/*.json`, `locales/*.json` —
never by editing shipped source. See [theme/README.md](theme/README.md).
`zalify theme upgrade` overwrites theme-owned files but never touches
`theme/`, `.env`, or `public/` additions; edits to shipped source are
3-way-merged. In the monorepo the multi-tenant equivalent is
`stores/<slug>/theme/` (see `stores/README.md`).

## What is shared vs app-local

**Shared (never hand-edit — synced or imported):**

- `config/`, `templates/`, `locales/`, `sections/*.json`,
  `app/styles/critical.css`, `app/styles/components/*` — copied from
  `apps/liquid` by `pnpm sync` (repo root).
- `lib/theme-data.generated.ts` — the parsed theme schema as a typed
  TS module, also emitted by `pnpm sync` (Next has no
  `import.meta.glob`, so this is how the schema loads).
- `@zalify/ui-react` — theme engine (`installTheme`, `ThemeTemplate`,
  `SectionGroup`, `CssVariables`, `t()`), shared components
  (`ProductCard`, `Facets`, `Icon`, `Price`…), and all builtin
  sections/blocks (hero, stories, rich-text, announcement-bar, page,
  article, 404…).
- `@zalify/commerce-core` — money/facets/product/event logic.

**App-local (`lib/`, `components/`, `app/`):**

- `lib/storefront.ts` — minimal fetch-based Storefront API client
  (shape satisfies ui-react's `SectionLoaderArgs.storefront`).
- `lib/theme-setup.ts` — `installTheme()` with the explicit section/
  block registries (client-module graph; imported by
  `app/providers.tsx` and the client wrappers).
- `lib/theme-server.ts` + `lib/section-loaders.ts` — server-side
  template lookups and the section-loader runner
  (featured-collection, product-recommendations).
- `lib/cart.ts` / `lib/cart-mutations.ts` — cart id in a per-store
  httpOnly cookie; every mutation expressed as an *intent*
  (add / increase / decrease / set / remove / discount-apply /
  discount-remove / note-update).
- `app/api/cart/route.ts` — the single cart endpoint. GET returns the
  cart, POST applies one intent. Fetches get JSON back; native form
  posts (JS off) get a 303 back to the referring page. The tenant is
  resolved from the Host header, so the mutation lands on the cart of
  the store that served the page.
- `components/cart/cart-store.ts` — the optimistic cart store: last
  confirmed cart + in-flight optimistic ops, replayed on read. Buys
  instant feedback, per-entity aborts (hammering −/− on a line issues
  one effective mutation, no debounce), and rollback by simply
  dropping the failed op.
- `components/cart/cart-context.tsx` — the React seam over it:
  `useCart(selector)` and the form contract `useCartForm()`
  (`formProps()` + `register()`), which keeps every mutation a real
  `<form>` posting to `/api/cart` so the theme still works with JS off.
- `lib/theme-adapter.tsx` — ui-react's `ThemeAdapter` mapped onto
  next/link + next/navigation; `CartAddForm` posts intent=add through
  the store and emits commerce-core's `cart:updated`.
- `components/sections/` + `components/blocks/` — ports of the
  Hydrogen app-local sections (header, footer, product + gallery,
  collection, collections, search, blog, cart, cart-drawer,
  quick-add, predictive-search, product-recommendations) and product
  blocks (`_title`, `_variant-picker`, `_buy-buttons`, `_quantity`,
  `_size-guide`, `_description`). Markup and class names match the
  Liquid source — the extracted CSS is shared.
- `app/` routes: `/`, `/products/[handle]`, `/collections`,
  `/collections/all`, `/collections/[handle]`, `/search`, `/cart`,
  `/pages/[handle]`, `/blogs/[blogHandle]`, `/blogs/[blogHandle]/
  [articleHandle]`, plus `not-found.tsx` (theme 404 template).

## Overlays (cart drawer, quick-add, predictive search)

The three overlays speak the theme's dialog + event contracts
(`apps/liquid/src/lib/dialog.ts`, `@zalify/commerce-core` events):

- **Cart drawer** (`components/sections/cart-drawer.tsx`, rendered by
  the overlay-group) — a document-level click listener opens it for
  any `[data-dialog-open="CartDrawer"]` element (the header's cart
  link, whose `/cart` href stays as the no-JS fallback);
  `[data-dialog-close]`, backdrop click and Esc close it. It also
  opens on commerce-core's `cart:updated`, which the adapter's
  `CartAddForm` emits on submit — so PDP buy buttons, single-variant
  card quick-adds and the quick-add dialog all pop the drawer.
  Contents come from `useCart()`; quantity, removals and the voucher
  are `useCartForm()` intents that apply optimistically, with pending
  lines dimmed instead of a spinner and no debounce (the store aborts
  the superseded mutation per line). Free-shipping progress, voucher
  chip and totals mirror the Liquid section (settings from
  `sections/overlay-group.json`).
- **Quick-add** (`components/theme/QuickAddDialog.tsx` +
  `components/sections/quick-add.tsx`, mounted once in the root
  layout) — ui-react's `ProductCard` checks for the `#QuickAddDialog`
  element and emits `quick-add:open` with the card's product; the
  dialog subscribes via commerce-core's `on()` and renders the option
  pickers + add-to-bag (`CartAddForm`). On success `cart:updated`
  fires: the quick-add dialog closes and the cart drawer opens.
- **Predictive search** (`components/sections/predictive-search.tsx`,
  mounted once in the root layout) — the header search icon is an
  `<a href="/search" data-dialog-open="SearchDrawer">` (href = no-JS
  fallback); the drawer opens on that attribute contract. Input is
  debounced 250 ms into `GET /api/predictive-search?q=…` — a route
  handler (`app/api/predictive-search/route.ts`) running the
  Storefront `predictiveSearch` query (ported from the Hydrogen
  mirror's `/search?predictive` fetcher, same
  `{type, term, result: {total, items}}` envelope). Enter or the
  submit button navigates to `/search?q=…`. Stores without
  `predictiveSearch` degrade to an empty result.

Every cart mutation posts to `/api/cart` and applies optimistically:
the header count, cart page and drawer all select from the same store,
so they update on click and reconcile together when the server answers
— no route refetch, and no provider changes were needed for the
overlays.

## How rendering works here

Server pages fetch route resources with plain GraphQL queries, run the
template's section loaders via `loadSectionData` (lib/theme-server.ts),
and hand everything to a tiny `'use client'` wrapper
(`components/ThemeTemplateClient.tsx`) that renders ui-react's
`<ThemeTemplate>`; the root layout renders the header/footer/overlay
`<SectionGroup>`s the same way. Variant selection state is the URL's
`?variant=<numeric id>` param (the Liquid store / ProductCard
deep-link format; legacy `Color=Red&Size=M` pairs still resolve): the
variant picker writes it with native `history.replaceState` — a pure
client-side update, no server round trip — and every consumer derives
the selected variant per render (`components/use-selected-variant.ts`
— the pure replacement for Hydrogen's `useOptimisticVariant`). The
product fetch is keyed by handle alone, so all variants share one
cache entry. Pagination uses cursor links with
Hydrogen's `cursor`/`direction` URL contract; collection/search filters
use commerce-core's facets contract (`sort_by`, `filter.<key>=<json>`).

## How caching and rendering work (blocking SSR)

This template deliberately does **not** use Next 16's Cache
Components: that model requires every runtime-data page to stream
through a `<Suspense>` hole (skeleton → content swap), and we prefer
the classic navigation feel — the browser stays on the previous page
until the next one is fully rendered. Every route is server-rendered
per request (`ƒ` in the build output; the layout reads the cart
cookie, so nothing prerenders statically). What keeps it fast is the
data cache:

**Cached (`unstable_cache`, revalidate 3600s):**

| Data | Where | Tag |
| --- | --- | --- |
| Shop + header/footer menus | `app/layout.tsx` `loadGlobals()` | `menus` |
| Section-loader results (featured-collection, product-recommendations) | `lib/theme-server.ts` `loadCachedSectionData(template, params)` | `products` |
| Product by (handle, selectedOptions) | `app/products/[handle]/page.tsx` | `products` |
| Catalog + search results per (term/sort/filters/cursor) | `app/collections/all`, `app/search` | `products` |
| Collection by (handle, filters, sort, cursor), collections list | `app/collections/[handle]`, `app/collections` | `collections` |
| Pages, blogs, articles by handle | `app/pages/…`, `app/blogs/…` | `content` |

The cached functions key on their arguments plus the listed tag.
Errors thrown by the storefront client propagate out of the cached
scope, so failures are never cached.

**Never cached:**

- **The cart** — cookie-backed runtime data. The layout passes
  `getCart()`'s promise (not its value) into the client
  `CartProvider`, which bootstraps the cart store with it after
  hydration — so the cart never blocks page rendering, and the store
  owns it from then on.
- **Page rendering itself** — pages await `params`/`searchParams` and
  their (cached) data directly; there are no per-page Suspense holes
  and no loading skeletons.

**Revalidation:**

- Time-based: hourly (`revalidate: 3600`) everywhere.
- On-demand: `revalidateTag('products' | 'collections' | 'content' |
  'menus')` from a route handler or server action.
- Cart mutations: the cart is never cached and never revalidates a
  route — `/api/cart` answers with the fresh cart and the client store
  reconciles, so the header count, cart page and drawer all update
  without a server re-render.

**Trade-offs vs Cache Components** (accepted deliberately):

- No static shells / partial prerendering: TTFB includes the render,
  though warm `unstable_cache` entries make that cheap.
- `notFound()` now returns a real 404 status (an improvement — under
  the streaming model the shell's 200 was already sent).
- If you ever want the streaming model back, git history has the full
  Cache Components implementation (static shells, 'use cache' tags,
  skeleton fallbacks).

### Why the server side has local copies of two small pieces

Next resolves `react` with the `react-server` condition inside the
server-component graph, where client hooks don't exist — and both
`@zalify/ui-react` entry points (`.` and `./server`) transitively
import hook-using components (ProductCard, Facets). Server code
therefore imports **types only** from the package and keeps local
mirrors of:

- `loadSectionData`/`getTemplate` (~60 lines, `lib/theme-server.ts`),
- `PRODUCT_CARD_FRAGMENT` + the featured-collection loader
  (`lib/fragments.ts`, `lib/section-loaders.ts`) — keep these in sync
  with `packages/ui-react` when the originals change.

## v1 limitations (by design)

- **No customer accounts** — the header "Log in" link is inert
  scaffolding (`/account` is unrouted).
- **No localization** — `t()` serves `en.default`; the
  country/language selects are single-option visual approximations.
- Contact & newsletter forms render but don't submit (no Shopify form
  endpoints outside Liquid); `_size-guide` opens an empty modal (page
  content fetch TODO); settings referencing theme-editor uploads
  (`shopify://…`) render placeholders, matching a fresh install.
- mock.shop doesn't implement every field the queries ask for (e.g.
  menus, search, filters may come back empty); the app degrades to
  fallbacks (built-in nav menu, empty results) instead of erroring.
