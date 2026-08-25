/**
 * Single-tenant layout — the classic env-configured store
 * (NEXT_PUBLIC_STORE_DOMAIN / NEXT_PUBLIC_STOREFRONT_API_TOKEN; unset →
 * mock.shop). Serves the original top-level URLs; multi-tenant hosts
 * never land here (the middleware rewrites them to /s/<slug>/…).
 */
import type {ReactNode} from 'react';
import StoreLayout from '~/components/StoreLayout';
import {defaultStoreConfig} from '~/lib/store-config';

export default function DefaultLayout({children}: {children: ReactNode}) {
  return <StoreLayout store={defaultStoreConfig}>{children}</StoreLayout>;
}
