# CDN Pixel Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the Shopify headless demo's CDN Pixel event tracking so storefront behavior can be forwarded to configured advertising destinations.

**Architecture:** Keep the CDN loader in `StoreLayout`, route browser events through the existing `trackPixel` adapter, and use `PixelEvents` as the single page-level event bridge. Preserve the custom React forms and UniSubmit flow, including their `form_submitted` and `lead` events.

**Tech Stack:** Hydrogen-style Shopify storefront, Next.js, React, TypeScript, Zalify CDN Pixel.

---

### Task 1: Audit and complete the page event bridge

**Files:**
- Modify: `components/theme/PixelEvents.tsx`
- Modify: `lib/pixel.ts` only if the adapter needs a typed event boundary

- [x] **Step 1: Inspect existing Shopify browser event listeners and payloads.**
- [x] **Step 2: Add `page_viewed` for client-side route transitions, preserving the CDN loader's initial page view.**
- [x] **Step 3: Keep all events routed through `trackPixel` so the queue stub works before `pixel.js` loads.**

### Task 2: Verify the integration

**Files:**
- Test: existing TypeScript/build checks

- [x] **Step 1: Run `pnpm run typecheck` from the demo root.**
- [x] **Step 2: Run `pnpm run build` from the demo root.**
- [x] **Step 3: Confirm the generated storefront still includes the CDN Pixel loader and workspace ID.**
- [ ] **Step 4: Commit with `fix(pixel): complete cdn event tracking`.**
