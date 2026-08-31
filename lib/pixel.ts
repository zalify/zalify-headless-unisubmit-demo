export type PixelEvent = {
  event: string;
  properties?: Record<string, unknown>;
  at: string;
};

export function trackPixel(
  event: string,
  properties?: Record<string, unknown>,
): void {
  if (typeof window === 'undefined') return;
  window.zalify?.('track', event, properties);
}

export function setPixelProperty(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  window.zalify?.('set', key, value);
}

declare global {
  interface Window {
    zalify?: (command: string, ...args: unknown[]) => void;
  }
}
