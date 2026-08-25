/**
 * /cart — templates/cart.json. The page itself is a static shell; the
 * cart section reads the cookie-backed cart from the store the layout
 * bootstraps with its cart promise (components/cart/cart-context.tsx).
 * Mutations post to /api/cart and apply optimistically.
 */
import type {Metadata} from 'next';
import ThemeTemplateClient from '~/components/ThemeTemplateClient';

export const metadata: Metadata = {title: 'Cart'};

export default function CartPage() {
  return <ThemeTemplateClient name="cart" />;
}
