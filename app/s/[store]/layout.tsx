/**
 * Multi-tenant layout — one registry store per hostname, reached via
 * the middleware rewrite /s/<slug>/… (the browser URL never shows the
 * /s prefix). The slug is validated against the generated registry;
 * unknown slugs 404. Store data (globals, cart) flows through the same
 * StoreLayout the single-tenant tree uses.
 */
import type {Metadata} from 'next';
import type {ReactNode} from 'react';
import StoreLayout from '~/components/StoreLayout';
import {getStoreBySlug} from '~/lib/store-config';
import {requireStore} from '~/lib/resolve-store';

type Params = Promise<{store: string}>;

export async function generateMetadata({params}: {params: Params}): Promise<Metadata> {
  const store = getStoreBySlug((await params).store);
  if (!store?.name) return {};
  return {
    title: {
      default: store.name,
      template: `%s | ${store.name}`,
    },
  };
}

export default async function TenantLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Params;
}) {
  const store = requireStore((await params).store);
  return <StoreLayout store={store}>{children}</StoreLayout>;
}
