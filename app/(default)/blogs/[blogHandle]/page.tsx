/**
 * Blog index (single-tenant) — thin wrapper binding the env-configured
 * store; the body lives in lib/pages/blog.tsx.
 */
import type {Metadata} from 'next';
import {defaultStoreConfig} from '~/lib/store-config';
import {BlogPage, blogMetadata} from '~/lib/pages/blog';
import type {RawSearchParams} from '~/lib/pages/product';

type Params = Promise<{blogHandle: string}>;
type SearchParams = Promise<RawSearchParams>;

export async function generateMetadata({params}: {params: Params}): Promise<Metadata> {
  return blogMetadata((await params).blogHandle);
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  return (
    <BlogPage
      store={defaultStoreConfig}
      blogHandle={(await params).blogHandle}
      searchParams={await searchParams}
    />
  );
}
