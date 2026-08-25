# theme/ — your store's theme data

This folder is **yours** (merchant-owned). `zalify theme upgrade` never
touches anything in here — it's how your customization survives theme
version upgrades.

Drop any of these files in and they take effect on the next `dev`/`build`
(compiled by `scripts/generate-store-theme-data.mjs` into
`lib/store-theme/default.generated.ts`):

| File                         | Resolution                                        |
| ---------------------------- | ------------------------------------------------- |
| `settings_data.json`         | replaces the theme's default settings wholesale   |
| `templates/*.json`           | replace the same-named default template; others fall through |
| `templates/customers/*.json` | same, for customer/account templates              |
| `sections/*-group.json`      | replace the same-named section group (header/footer/overlay — announcement bar, footer text, cart drawer) |
| `locales/*.json`             | overrides deep-merged over the theme defaults     |

Start by copying a default from the theme source — e.g.
`node_modules/@zalify/storefront-kit`'s synced defaults or the
`config/`/`templates/`/`locales/` mirrors in this project — then edit.
JSON may carry Shopify-style leading `/* … */` block comments.

| `pixel.json`                 | Zalify Pixel config: `{ "workspaceId": "…" }` — enables analytics + ad forwarding (https://cdn.zalify.com/llms.txt). Written automatically by `zalify shop create`; add by hand for self-hosted deploys; delete to disable. For GDPR opt-in mode, the theme can be extended to append `consentRequired=true` to the loader. |

An empty folder (just this README) changes nothing: the app renders the
theme defaults.
