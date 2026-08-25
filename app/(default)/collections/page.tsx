/**
 * /collections (single-tenant) — thin wrapper binding the
 * env-configured store; the body lives in lib/pages/collections-index.tsx.
 */
import type {Metadata} from 'next';
import {defaultStoreConfig} from '~/lib/store-config';
import {CollectionsIndexPage} from '~/lib/pages/collections-index';
import type {RawSearchParams} from '~/lib/pages/product';

type SearchParams = Promise<RawSearchParams>;

export const metadata: Metadata = {title: 'Collections'};

export default async function Page({searchParams}: {searchParams: SearchParams}) {
  return <CollectionsIndexPage store={defaultStoreConfig} searchParams={await searchParams} />;
}
