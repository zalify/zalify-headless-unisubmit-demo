/**
 * Root layout — the store-agnostic shell: <html>/<body> plus
 * critical.css and the extracted component CSS (both come from the
 * theme, not from any store's data).
 *
 * Everything store-specific (theme providers, header/footer/overlay
 * groups, globals, cart) lives in components/StoreLayout.tsx, mounted
 * by the two segment layouts:
 * - app/(default)/layout.tsx — the classic env-configured store
 *   (single-tenant mode; also the fallback when no Host matches).
 * - app/s/[store]/layout.tsx — registry stores, reached through the
 *   multi-tenant middleware rewrite.
 */
import './styles/critical.css';
import './styles/components.css';
import type {Metadata} from 'next';
import type {ReactNode} from 'react';

export const metadata: Metadata = {
  title: {
    default: 'Zalify Storefront',
    template: '%s | Zalify Storefront',
  },
};

export default function RootLayout({children}: {children: ReactNode}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
