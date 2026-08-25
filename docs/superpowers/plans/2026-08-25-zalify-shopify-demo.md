# Zalify Shopify Headless Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a self-contained Zalify pixel, inline form, and popup form demonstration to the generated Shopify headless storefront.

**Architecture:** Keep the generated Next.js/Shopify shell unchanged and add a small client integration module for the UniSubmit envelope and event ordering. A reusable form component renders inline or inside a modal, while a page-level demo component exposes both paths and a local event log.

**Tech Stack:** Next.js 16, React 19, TypeScript, Shopify Storefront template, browser Fetch API

---

### Task 1: Configure the pixel and public demo settings

**Files:**
- Create: `theme/pixel.json`
- Modify: `.env.example`
- Modify: `README.md`

- [ ] **Step 1: Add the pixel workspace configuration**

Create `theme/pixel.json`:

```json
{
  "workspaceId": "cms55ktzi00i01wr2vivht5n4"
}
```

This causes the existing `StoreLayout` to load `https://cdn.zalify.com/pixel.js?wid=...`.

- [ ] **Step 2: Document the public List ID setting**

Add `NEXT_PUBLIC_ZALIFY_LIST_ID=` to `.env.example` and document that it is a public List ID, not a secret. Explain that the demo shows a configuration error until a real List ID is supplied.

- [ ] **Step 3: Commit configuration**

```bash
git add theme/pixel.json .env.example README.md
git commit -m "feat: configure zalify pixel demo"
```

### Task 2: Implement the shared UniSubmit client

**Files:**
- Create: `lib/zalify-unisubmit.ts`
- Test manually through the form in Task 3

- [ ] **Step 1: Define the input and event types**

Use `workspaceId`, `formId`, optional `listId`, `idempotencyKey`, contact fields, consent, and optional custom payload. Keep `window.zalify` optional.

- [ ] **Step 2: Build and send the request**

Send the exact body shape with `wid`, normalized `identity`, `submission.form_id`, `submission.provider: "api"`, `submission.payload`, `subscribe`, `context.page_url`, and `idempotency_key`. Use `credentials: "omit"` and check `response.ok` without parsing an undocumented response body.

- [ ] **Step 3: Preserve event ordering**

Call `trackPixel("form_submitted", ...)` before Fetch and `trackPixel("lead", {email})` only after `response.ok`. Throw safe errors containing only the HTTP status or a network-failure message.

### Task 3: Add reusable inline and popup form UI

**Files:**
- Create: `components/ZalifySignupForm.tsx`
- Create: `components/ZalifyDemo.tsx`
- Create: `app/styles/components/zalify-demo.css`

- [ ] **Step 1: Render the form states**

Render email, optional first name, a marketing consent checkbox, submit button, and success/error messages. Disable duplicate submits while submitting.

- [ ] **Step 2: Add popup behavior**

Use the same `ZalifySignupForm` inside a dialog-style overlay. The popup opens from a button, closes from the close button or backdrop, and does not use a remote popup document.

- [ ] **Step 3: Add the verification card**

Render inline form, popup trigger, current configuration status, and a compact event log fed by the form callbacks. Keep all visible copy focused on verifying the integration.

### Task 4: Mount the demo on the Shopify home page

**Files:**
- Modify: `app/(default)/page.tsx`
- Modify: `app/(default)/pages/[handle]/page.tsx` only if the template requires a shared demo route
- Modify: `app/styles/critical.css` or import the component stylesheet from the demo component

- [ ] **Step 1: Mount the client demo above the existing commerce homepage**

Keep `HomePage store={defaultStoreConfig}` intact and render the demo in a client boundary so server-side Shopify data fetching is unchanged.

- [ ] **Step 2: Verify responsive layout**

Ensure the card works on mobile and desktop, the popup is keyboard-dismissible, and the existing theme styles remain unaffected.

### Task 5: Verify and publish

**Files:**
- Verify: all files above

- [ ] **Step 1: Install dependencies and run typecheck**

```bash
pnpm install
pnpm run typecheck
```

Expected: exit 0 with no TypeScript errors.

- [ ] **Step 2: Run a production build**

```bash
pnpm run build
```

Expected: exit 0 and a generated Next.js production build.

- [ ] **Step 3: Test both forms in the browser**

Run `pnpm dev`, open the local home page, submit inline and popup forms with a configured `NEXT_PUBLIC_ZALIFY_LIST_ID`, and verify Network requests target `https://reach.zalify.com/v1/public/unisubmit`. Verify failed requests show error state and do not fire `lead`.

- [ ] **Step 4: Push the open-source demo**

```bash
git push origin main
```

The existing Zalify site deployment will rebuild from the pushed repository.
