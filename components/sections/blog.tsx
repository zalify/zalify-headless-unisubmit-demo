'use client';
/**
 * Port of sections/blog.liquid (via the Hydrogen mirror) — articles
 * grid with an optional featured (newest) post on the first page.
 * CSS: app/styles/components/sections-blog.css
 *
 * Data: useResource('blog') — {title, handle, articles: {nodes:
 * ArticleItem[], pageInfo}}.
 */
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import type {SectionProps} from '@zalify/storefront-kit/react';
import {PlaceholderSvg, imageUrl, t, useResource} from '@zalify/storefront-kit/react';
import {PaginationLinks} from '~/components/Pagination';

interface BlogSettings {
  show_featured?: boolean;
  color_scheme?: string;
  section_spacing?: string;
}

/** Mirror of `published_at | time_tag: format: 'date'`. */
function articleDateHtml(publishedAt?: string): string {
  if (!publishedAt) return '';
  const formatted = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(publishedAt));
  return `<time datetime="${publishedAt}">${formatted}</time>`;
}

/** Mirror of `excerpt_or_content | strip_html | truncatewords: n`. */
function excerpt(article: any, words: number): string {
  const source: string =
    article?.excerpt ?? article?.contentHtml ?? article?.content ?? '';
  const text = source
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const parts = text.split(' ');
  if (parts.length <= words) return text;
  return `${parts.slice(0, words).join(' ')}...`;
}

function articleUrl(article: any, blogHandle?: string): string {
  return `/blogs/${article.blog?.handle ?? blogHandle ?? ''}/${article.handle}`;
}

function ArticleImage({
  article,
  className,
  loading,
  sizes,
}: {
  article: any;
  className: string;
  loading: 'eager' | 'lazy';
  sizes: string;
}) {
  if (!article.image) {
    return (
      <PlaceholderSvg className={`${className} article-card__placeholder`} />
    );
  }
  return (
    <img
      className={className}
      src={imageUrl(article.image.url, 1200)}
      alt={article.image.altText ?? article.title}
      width={article.image.width ?? undefined}
      height={article.image.height ?? undefined}
      sizes={sizes}
      loading={loading}
    />
  );
}

function ArticleMeta({article}: {article: any}) {
  return (
    <p
      className="article-card__meta"
      dangerouslySetInnerHTML={{
        __html: t('blog.article_metadata_html', {
          date: articleDateHtml(article.publishedAt),
          author: article.author?.name ?? '',
        }),
      }}
    />
  );
}

export default function BlogSection({settings}: SectionProps<BlogSettings>) {
  const {
    show_featured: showFeatured = true,
    color_scheme: colorScheme = 'scheme-1',
    section_spacing: spacing = 'md',
  } = settings;
  const blog = useResource<any>('blog');
  const searchParams = useSearchParams();

  if (!blog) return null;

  const isFirstPage =
    !searchParams.get('cursor') && !searchParams.get('direction');

  const articles: any[] = blog.articles?.nodes ?? [];
  const featured = showFeatured && isFirstPage ? articles[0] : undefined;
  const gridArticles = featured ? articles.slice(1) : articles;

  return (
    <div
      className={`blog section color-${colorScheme} full-width`}
      style={
        {
          '--section-spacing': `var(--space-section-${spacing})`,
        } as React.CSSProperties
      }
    >
      <div
        className="blog__inner stack"
        style={{'--stack-gap': 'var(--space-xl)'} as React.CSSProperties}
      >
        <h1 className="blog__title">{blog.title}</h1>

        {articles.length === 0 && <p className="blog__empty">{t('blog.empty')}</p>}

        {featured && (
          <article className="article-feature">
            <Link
              href={articleUrl(featured, blog.handle)}
              className="article-feature__media"
            >
              <ArticleImage
                article={featured}
                className="article-feature__image"
                sizes="(min-width: 48rem) 62vw, 100vw"
                loading="eager"
              />
            </Link>
            <div
              className="article-feature__body stack"
              style={{'--stack-gap': 'var(--space-sm)'} as React.CSSProperties}
            >
              <ArticleMeta article={featured} />
              <h2 className="article-feature__title">
                <Link href={articleUrl(featured, blog.handle)}>
                  {featured.title}
                </Link>
              </h2>
              {excerpt(featured, 40) && (
                <p className="article-card__excerpt">{excerpt(featured, 40)}</p>
              )}
            </div>
          </article>
        )}

        <ul className="blog__grid" role="list">
          {gridArticles.map((article) => (
            <li key={article.id}>
              <article
                className="article-card stack"
                style={{'--stack-gap': 'var(--space-sm)'} as React.CSSProperties}
              >
                <Link
                  href={articleUrl(article, blog.handle)}
                  className="article-card__media"
                >
                  <ArticleImage
                    article={article}
                    className="article-card__image"
                    sizes="(min-width: 48rem) 33vw, 100vw"
                    loading="lazy"
                  />
                </Link>
                <ArticleMeta article={article} />
                <h2 className="article-card__title">
                  <Link href={articleUrl(article, blog.handle)}>
                    {article.title}
                  </Link>
                </h2>
                {excerpt(article, 24) && (
                  <p className="article-card__excerpt">{excerpt(article, 24)}</p>
                )}
              </article>
            </li>
          ))}
        </ul>

        <PaginationLinks
          pageInfo={blog.articles?.pageInfo}
          className="blog__pagination"
        />
      </div>
    </div>
  );
}
