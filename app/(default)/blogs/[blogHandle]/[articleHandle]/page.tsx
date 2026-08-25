/**
 * Article page (single-tenant) — thin wrapper binding the
 * env-configured store; the body lives in lib/pages/article.tsx.
 */
import type {Metadata} from 'next';
import {defaultStoreConfig} from '~/lib/store-config';
import {ArticlePage, articleMetadata} from '~/lib/pages/article';

type Params = Promise<{blogHandle: string; articleHandle: string}>;

export async function generateMetadata({params}: {params: Params}): Promise<Metadata> {
  const {blogHandle, articleHandle} = await params;
  return articleMetadata(defaultStoreConfig, blogHandle, articleHandle);
}

export default async function Page({params}: {params: Params}) {
  const {blogHandle, articleHandle} = await params;
  return (
    <ArticlePage
      store={defaultStoreConfig}
      blogHandle={blogHandle}
      articleHandle={articleHandle}
    />
  );
}
