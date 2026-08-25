/**
 * Article page body — templates/article.json (the 'article' section is
 * a ui-react builtin). Shared by
 * app/(default)/blogs/[blogHandle]/[articleHandle] and
 * app/s/[store]/blogs/[blogHandle]/[articleHandle].
 *
 * Blocking SSR (no Cache Components): the page awaits its data before
 * rendering. The fetch is wrapped in a per-store unstable_cache, keyed
 * per (slug, blog, article) with tags 'content' + 'content:<slug>'.
 */
import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {getStorefront} from '~/lib/storefront';
import type {StoreConfig} from '~/lib/store-config';
import {storeCache} from '~/lib/store-cache';
import ThemeTemplateClient from '~/components/ThemeTemplateClient';

/** Cached per (store, blog, article); tag 'content[:<slug>]'. Errors are not cached. */
const queryArticle = storeCache('queryArticle', queryArticleUncached, {
  revalidate: 3600,
  tags: ['content'],
});

async function queryArticleUncached(
  store: StoreConfig,
  blogHandle: string,
  articleHandle: string,
) {
  const data = await getStorefront(store).query(ARTICLE_QUERY, {
    variables: {blogHandle, articleHandle},
  });
  return data?.blog?.articleByHandle ?? null;
}

async function loadArticle(
  store: StoreConfig,
  blogHandle: string,
  articleHandle: string,
) {
  try {
    return await queryArticle(store, blogHandle, articleHandle);
  } catch (error: unknown) {
    console.error('[article] query failed', error);
    return null;
  }
}

export async function articleMetadata(
  store: StoreConfig,
  blogHandle: string,
  articleHandle: string,
): Promise<Metadata> {
  const article = await loadArticle(store, blogHandle, articleHandle);
  if (!article) return {};
  return {
    title: article.seo?.title ?? article.title,
    description: article.seo?.description ?? undefined,
  };
}

export async function ArticlePage({
  store,
  blogHandle,
  articleHandle,
}: {
  store: StoreConfig;
  blogHandle: string;
  articleHandle: string;
}) {
  const article = await loadArticle(store, blogHandle, articleHandle);
  if (!article) notFound();

  return <ThemeTemplateClient name="article" resources={{article}} />;
}

const ARTICLE_QUERY = `#graphql
  query Article($articleHandle: String!, $blogHandle: String!) {
    blog(handle: $blogHandle) {
      handle
      articleByHandle(handle: $articleHandle) {
        handle
        title
        contentHtml
        publishedAt
        author: authorV2 {
          name
        }
        image {
          id
          altText
          url
          width
          height
        }
        seo {
          description
          title
        }
      }
    }
  }
` as const;
