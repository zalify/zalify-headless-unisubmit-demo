/**
 * /collections/all (single-tenant) — thin wrapper binding the
 * env-configured store; the body lives in lib/pages/catalog.tsx.
 */
import type {Metadata} from 'next';
import {defaultStoreConfig} from '~/lib/store-config';
import {CatalogPage} from '~/lib/pages/catalog';
import type {RawSearchParams} from '~/lib/pages/product';

type SearchParams = Promise<RawSearchParams>;

export const metadata: Metadata = {title: 'Products'};

export default async function Page({searchParams}: {searchParams: SearchParams}) {
  return <CatalogPage store={defaultStoreConfig} searchParams={await searchParams} />;
}
