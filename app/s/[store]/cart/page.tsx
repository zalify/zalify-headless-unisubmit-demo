/**
 * /cart (multi-tenant) — templates/cart.json. Static shell; the cart
 * itself comes from the store bootstrapped by the tenant layout's
 * cart promise (per-store cookie), and mutations post to /api/cart,
 * which resolves the tenant from the Host header. The slug is
 * validated so unknown stores 404.
 */
import type {Metadata} from 'next';
import {requireStore} from '~/lib/resolve-store';
import ThemeTemplateClient from '~/components/ThemeTemplateClient';

type Params = Promise<{store: string}>;

export const metadata: Metadata = {title: 'Cart'};

export default async function CartPage({params}: {params: Params}) {
  requireStore((await params).store);
  return <ThemeTemplateClient name="cart" />;
}
