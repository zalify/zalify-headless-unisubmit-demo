/**
 * Client half of the Zalify Pixel integration — fire events through the
 * queue stub StoreLayout embeds (see lib/pixel-server.ts). Safe no-op
 * when the pixel is absent or blocked; the stub queues events fired
 * before pixel.js finishes loading, so this never races hydration.
 * Docs: https://cdn.zalify.com/llms.txt
 */
export function trackPixel(
  event: string,
  properties?: Record<string, unknown>,
): void {
  if (typeof window === 'undefined') return;
  (
    window as {zalify?: (...args: unknown[]) => void}
  ).zalify?.('track', event, properties);
}

/**
 * Attach a persistent property to every subsequent pixel event
 * (`zalify('set', …)` — spread into properties after the built-ins, so
 * it also overrides values the pixel could not read itself, like
 * cart_token behind our httpOnly cart cookie).
 */
export function setPixelProperty(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  (
    window as {zalify?: (...args: unknown[]) => void}
  ).zalify?.('set', key, value);
}
