'use client';
/**
 * Port of sections/product.liquid (via the Hydrogen mirror) — the main
 * product section: media gallery (scroll-snap carousel on mobile,
 * carousel/stacked on desktop) with media grouped per variant-image
 * option value, fullscreen lightbox carousel, theme blocks in the info
 * column, and the mobile sticky add-to-cart bar.
 *
 * The URL's option search params are the shared selected-variant
 * state: the variant-picker block navigates (router.replace,
 * scroll:false) and every consumer derives the variant per render via
 * useSelectedVariant (the pure replacement for useOptimisticVariant).
 *
 * CSS: app/styles/components/sections-product.css
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {SectionProps} from '@zalify/storefront-kit/react';
import {Icon, imageUrl, t, useResource} from '@zalify/storefront-kit/react';
import {formatMoney, type Money} from '@zalify/storefront-kit/commerce';
import {useSelectedVariant} from '~/components/use-selected-variant';
import {CartAddForm} from '~/lib/theme-adapter';

interface ProductSettings {
  desktop_media_layout?: 'carousel' | 'stacked';
  show_thumbnails?: boolean;
  show_sticky_bar?: boolean;
  mobile_media_layout?: 'full' | 'peek';
  color_scheme?: string;
  section_spacing?: 'none' | 'sm' | 'md' | 'lg';
}

/* ------------------------------------------------------------------ *
 * Shared helpers (also used by blocks/_variant-picker.tsx)
 * ------------------------------------------------------------------ */

/** Mirror of Liquid's `| money` applied to `variant.price | times: qty`. */
export function multiplyMoney(money: Money, quantity: number): Money {
  return {
    amount: String(Number(money.amount) * quantity),
    currencyCode: money.currencyCode,
  };
}

function imageKey(url: string | null | undefined): string {
  return url ? url.split('?')[0] : '';
}

/**
 * Find the index of the product media entry showing a given image
 * (a variant's featured image). Matches by image id first, then by
 * CDN URL stripped of params.
 */
export function findMediaIndex(
  media: any[],
  image: {id?: string | null; url?: string | null} | null | undefined,
): number {
  if (!image) return -1;
  const key = imageKey(image.url);
  return media.findIndex((m) => {
    if (
      image.id &&
      (m?.image?.id === image.id || m?.previewImage?.id === image.id)
    ) {
      return true;
    }
    return (
      !!key &&
      (imageKey(m?.image?.url) === key || imageKey(m?.previewImage?.url) === key)
    );
  });
}

/** Mirror of product.has_only_default_variant. */
export function hasOnlyDefaultVariant(product: any): boolean {
  const options = product?.options ?? [];
  if (options.length === 0) return true;
  if (options.length > 1) return false;
  const values = options[0]?.optionValues ?? [];
  return values.length <= 1;
}

export interface MediaOption {
  /** Index of the option inside product.options. */
  index: number;
  name: string;
  /** Value names, in option order. */
  values: string[];
  /**
   * Per value: 1-based position of the media anchoring the value's
   * block (the value's first variant's featured image), 0 = none.
   */
  anchors: number[];
}

/**
 * Media-group option: the first option whose values map to variants
 * with distinct featured images (typically Color). Mirrors the Liquid
 * preamble of sections/product.liquid — each value's variant featured
 * image anchors the start of that value's media block by position.
 */
export function getMediaOption(product: any): MediaOption | null {
  const media: any[] = product?.media?.nodes ?? [];
  if (!media.length || hasOnlyDefaultVariant(product)) return null;
  const options = product?.options ?? [];
  for (let i = 0; i < options.length; i++) {
    const values: any[] = options[i]?.optionValues ?? [];
    const anchors = values.map((value) => {
      const index = findMediaIndex(media, value?.firstSelectableVariant?.image);
      return index >= 0 ? index + 1 : 0;
    });
    const distinct = new Set(anchors.filter((anchor) => anchor > 0));
    if (distinct.size > 1) {
      return {
        index: i,
        name: options[i].name as string,
        values: values.map((value) => value?.name as string),
        anchors,
      };
    }
  }
  return null;
}

/**
 * media_group_indexes: for each media, the media-option value index
 * owning it (largest anchor ≤ the media's position), or -1 for
 * shared/ungrouped media before the first anchor.
 */
export function getMediaGroups(media: any[], option: MediaOption | null): number[] {
  return media.map((_, i) => {
    if (!option) return -1;
    let best = 0;
    let group = -1;
    option.anchors.forEach((anchor, j) => {
      if (anchor > 0 && anchor <= i + 1 && anchor > best) {
        best = anchor;
        group = j;
      }
    });
    return group;
  });
}

/**
 * Quantity is shared between the _quantity block, the _buy-buttons
 * block and the sticky bar. The section owns the state; blocks consume
 * it through this context (mirror of the theme's ref="quantity" wiring
 * inside <product-info>).
 */
export const ProductQuantityContext = createContext<{
  quantity: number;
  setQuantity: (quantity: number) => void;
}>({quantity: 1, setQuantity: () => {}});

export function useProductQuantity() {
  return useContext(ProductQuantityContext);
}

function scrollBehavior(): ScrollBehavior {
  if (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return 'auto';
  }
  return 'smooth';
}

/* ------------------------------------------------------------------ *
 * Section
 * ------------------------------------------------------------------ */

export default function ProductSection({
  settings,
  children,
}: SectionProps<ProductSettings>) {
  const {
    desktop_media_layout: desktopLayout = 'carousel',
    show_thumbnails: showThumbnails = true,
    show_sticky_bar: showStickyBar = true,
    mobile_media_layout: mobileLayout = 'full',
    color_scheme: colorScheme = 'scheme-1',
    section_spacing: sectionSpacing = 'none',
  } = settings;

  const product = useResource<any>('product');
  const selectedVariant = useSelectedVariant(product);
  const [quantity, setQuantity] = useState(1);
  const quantityValue = useMemo(() => ({quantity, setQuantity}), [quantity]);

  if (!product) return null;

  return (
    <div
      className={`product section color-${colorScheme} full-width`}
      style={
        {
          '--section-spacing': `var(--space-section-${sectionSpacing})`,
        } as React.CSSProperties
      }
    >
      <div className="product__inner">
        <MediaGallery
          product={product}
          selectedVariant={selectedVariant}
          desktopLayout={desktopLayout}
          mobileLayout={mobileLayout}
          showThumbnails={showThumbnails}
        />

        <div
          className="product__info stack"
          style={{'--stack-gap': 'var(--space-md)'} as React.CSSProperties}
        >
          <ProductQuantityContext.Provider value={quantityValue}>
            {children}

            {showStickyBar ? (
              <StickyBar
                product={product}
                variant={selectedVariant}
                quantity={quantity}
              />
            ) : null}
          </ProductQuantityContext.Provider>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Media gallery (mirror of <media-gallery> in src/entries/product.ts)
 * ------------------------------------------------------------------ */

interface GalleryItem {
  media: any;
  /** Lowercased media-group option value owning this media, '' = shared. */
  group: string;
}

function MediaGallery({
  product,
  selectedVariant,
  desktopLayout,
  mobileLayout,
  showThumbnails,
}: {
  product: any;
  selectedVariant: any;
  desktopLayout: string;
  mobileLayout: string;
  showThumbnails: boolean;
}) {
  const media: any[] = product.media?.nodes ?? [];
  const mediaOption = useMemo(() => getMediaOption(product), [product]);
  const groups = useMemo(
    () => getMediaGroups(media, mediaOption),
    [media, mediaOption],
  );

  const selectedValue = mediaOption
    ? (
        selectedVariant?.selectedOptions?.find(
          (option: any) => option.name === mediaOption.name,
        )?.value ?? ''
      ).toLowerCase()
    : '';
  const selectedIndex = mediaOption
    ? mediaOption.values.findIndex(
        (value) => value.toLowerCase() === selectedValue,
      )
    : -1;
  const groupedMatches =
    selectedIndex >= 0
      ? groups.filter((group) => group === selectedIndex).length
      : 0;

  // Only media in the selected group (plus shared media) render; a
  // selection with no grouped media shows everything. React re-render
  // replaces the theme's filter()/hidden attribute toggling — filtered
  // media never mount, so lazy images never load.
  const visible: GalleryItem[] = useMemo(
    () =>
      media
        .map((m, i) => ({
          media: m,
          group:
            groups[i] >= 0 ? mediaOption!.values[groups[i]].toLowerCase() : '',
          hidden:
            groupedMatches > 0 && groups[i] !== -1 && groups[i] !== selectedIndex,
        }))
        .filter((item) => !item.hidden),
    [media, groups, mediaOption, groupedMatches, selectedIndex],
  );

  const trackRef = useRef<HTMLUListElement>(null);
  const thumbsRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const pendingRef = useRef<number | null>(null);
  const rafRef = useRef(0);

  /** Distance between slide starts — supports the mobile peek layout. */
  const stride = () => {
    const track = trackRef.current;
    const first = track?.querySelector<HTMLElement>('.product__media-item');
    if (!track || !first) return 0;
    const gap = Number.parseFloat(getComputedStyle(track).columnGap) || 0;
    return first.offsetWidth + gap;
  };

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const onScroll = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const step = stride();
        if (step === 0) return;
        const last = visible.length - 1;
        const next = Math.max(
          0,
          Math.min(Math.round(track.scrollLeft / step), last),
        );
        if (pendingRef.current !== null) {
          if (next !== pendingRef.current) return;
          pendingRef.current = null;
        }
        setIndex((current) => (next !== current ? next : current));
      });
    };
    const onUserScroll = () => {
      pendingRef.current = null;
    };
    track.addEventListener('scroll', onScroll, {passive: true});
    track.addEventListener('touchstart', onUserScroll, {passive: true});
    track.addEventListener('wheel', onUserScroll, {passive: true});
    return () => {
      cancelAnimationFrame(rafRef.current);
      track.removeEventListener('scroll', onScroll);
      track.removeEventListener('touchstart', onUserScroll);
      track.removeEventListener('wheel', onUserScroll);
    };
  }, [visible.length]);

  const goTo = (target: number, behavior?: ScrollBehavior) => {
    const track = trackRef.current;
    if (!track) return;
    const clamped = Math.max(0, Math.min(target, visible.length - 1));
    pendingRef.current = clamped;
    track.scrollTo({
      left: clamped * stride(),
      behavior: behavior ?? scrollBehavior(),
    });
    setIndex(clamped);
  };

  /**
   * Zero a scroller, killing any in-flight iOS momentum first (an
   * active fling ignores programmatic scrolls).
   */
  const resetScroll = (el: HTMLElement | null) => {
    if (!el) return;
    el.style.overflow = 'hidden';
    el.scrollLeft = 0;
    requestAnimationFrame(() => {
      el.style.overflow = '';
    });
  };

  // Variant/filter sync: when the media-group filter changes, reset the
  // track and thumbs against the re-filtered content; then land on the
  // selected variant's featured media (mirror of <product-info>'s
  // #update → gallery.goToMedia). On first render we only jump when the
  // URL carries an explicit selection.
  const filterKey = groupedMatches > 0 ? selectedIndex : -1;
  const prevFilterRef = useRef<number | null>(null);
  const variantImageId: string | undefined =
    selectedVariant?.image?.id ?? selectedVariant?.image?.url;
  useEffect(() => {
    const first = prevFilterRef.current === null;
    const filterChanged = !first && prevFilterRef.current !== filterKey;
    prevFilterRef.current = filterKey;
    if (filterChanged) {
      resetScroll(trackRef.current);
      resetScroll(thumbsRef.current);
      setIndex(0);
    }
    if (first && !window.location.search.includes('=')) return;
    const target = findMediaIndex(
      visible.map((item) => item.media),
      selectedVariant?.image,
    );
    if (target >= 0) {
      // A frame later and instant: the filter re-render must settle first
      requestAnimationFrame(() => goTo(target, 'auto'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, variantImageId]);

  // Keep the active thumb visible in the strip (mirror of #revealThumb)
  useEffect(() => {
    const strip = thumbsRef.current;
    if (!strip || strip.scrollWidth <= strip.clientWidth) return;
    const thumb = strip.children[index] as HTMLElement | undefined;
    if (!thumb) return;
    const stripRect = strip.getBoundingClientRect();
    const rect = thumb.getBoundingClientRect();
    if (rect.left < stripRect.left) {
      strip.scrollBy({
        left: rect.left - stripRect.left,
        behavior: scrollBehavior(),
      });
    } else if (rect.right > stripRect.right) {
      strip.scrollBy({
        left: rect.right - stripRect.right,
        behavior: scrollBehavior(),
      });
    }
  }, [index]);

  // --- Fullscreen zoom carousel (mirror of ref="lightbox") ----------

  const lightboxRef = useRef<HTMLDialogElement>(null);
  const lightTrackRef = useRef<HTMLDivElement>(null);
  const [lightIndex, setLightIndex] = useState(0);
  const lightPendingRef = useRef<number | null>(null);
  const lightRafRef = useRef(0);

  useEffect(() => {
    const track = lightTrackRef.current;
    if (!track) return;
    const onScroll = () => {
      cancelAnimationFrame(lightRafRef.current);
      lightRafRef.current = requestAnimationFrame(() => {
        if (track.clientWidth === 0) return;
        const next = Math.round(track.scrollLeft / track.clientWidth);
        if (lightPendingRef.current !== null) {
          if (next !== lightPendingRef.current) return;
          lightPendingRef.current = null;
        }
        setLightIndex((current) => (next !== current ? next : current));
      });
    };
    const onUserScroll = () => {
      lightPendingRef.current = null;
    };
    track.addEventListener('scroll', onScroll, {passive: true});
    track.addEventListener('touchstart', onUserScroll, {passive: true});
    track.addEventListener('wheel', onUserScroll, {passive: true});
    return () => {
      cancelAnimationFrame(lightRafRef.current);
      track.removeEventListener('scroll', onScroll);
      track.removeEventListener('touchstart', onUserScroll);
      track.removeEventListener('wheel', onUserScroll);
    };
  }, [visible.length]);

  const goToLight = (target: number, behavior?: ScrollBehavior) => {
    const track = lightTrackRef.current;
    if (!track) return;
    const clamped = Math.max(0, Math.min(target, visible.length - 1));
    lightPendingRef.current = clamped;
    track.scrollTo({
      left: clamped * track.clientWidth,
      behavior: behavior ?? scrollBehavior(),
    });
    setLightIndex(clamped);
  };

  /** Open the zoom carousel at the clicked slide. */
  const openLightbox = (target: number) => {
    const dialog = lightboxRef.current;
    if (!dialog) return;
    if (!dialog.open) {
      dialog.showModal();
      // Mirror of the Liquid dialog's `autofocus`: focus the dialog
      // itself, otherwise showModal() focuses the first segment button
      // and draws a focus ring that reads as a wrong "current slide"
      dialog.focus();
    }
    // Wait a frame so the track has layout before positioning
    requestAnimationFrame(() => {
      const track = lightTrackRef.current;
      if (!track) return;
      lightPendingRef.current = target;
      track.scrollTo({left: target * track.clientWidth});
      setLightIndex(target);
    });
  };

  /** Closing the zoom view lands the main gallery on the media just viewed. */
  const onLightboxClose = () => {
    goTo(lightIndex, 'auto');
  };

  /** Clicking the gray canvas around the image closes the lightbox. */
  const onLightboxBackdrop = (event: React.MouseEvent) => {
    if (event.target instanceof HTMLImageElement) return;
    lightboxRef.current?.close();
  };

  if (!media.length) {
    return (
      <div
        className={`product__gallery product__gallery--${desktopLayout} product__gallery--mobile-${mobileLayout}`}
      />
    );
  }

  return (
    <div
      className={`product__gallery product__gallery--${desktopLayout} product__gallery--mobile-${mobileLayout}`}
    >
      <div className="product__gallery-frame">
        <GalleryPreload media={visible[0]?.media} />
        <ul className="product__media-list" role="list" ref={trackRef}>
          {visible.map((item, i) => (
            <li
              key={item.media.id ?? i}
              className="product__media-item"
              data-media-id={item.media.id}
              data-media-group={item.group}
            >
              <GalleryMedia
                media={item.media}
                loading={i === 0 ? 'eager' : 'lazy'}
                onZoom={() => openLightbox(i)}
              />
            </li>
          ))}
        </ul>

        {media.length > 1 ? (
          <>
            <button
              type="button"
              className="product__gallery-arrow product__gallery-arrow--prev"
              onClick={() => goTo(index - 1)}
              aria-label={t('products.previous_image')}
            >
              <Icon name="icon-chevron-left" />
            </button>
            <button
              type="button"
              className="product__gallery-arrow product__gallery-arrow--next"
              onClick={() => goTo(index + 1)}
              aria-label={t('products.next_image')}
            >
              <Icon name="icon-chevron-right" />
            </button>
            <span className="product__gallery-counter">
              <span>{index + 1}</span>&thinsp;/&thinsp;
              <span>{visible.length}</span>
            </span>
          </>
        ) : null}
      </div>

      {media.length > 1 && showThumbnails ? (
        <div className="product__thumbs" role="list" ref={thumbsRef}>
          {visible.map((item, i) => (
            <button
              key={item.media.id ?? i}
              type="button"
              className="product__thumb"
              data-media-group={item.group}
              onClick={() => goTo(i)}
              aria-current={i === index || undefined}
              aria-label={`${product.title} ${i + 1}`}
            >
              <img
                src={imageUrl(item.media.previewImage?.url ?? '', 128)}
                alt={item.media.alt ?? ''}
                loading="lazy"
              />
            </button>
          ))}
        </div>
      ) : null}

      <dialog
        className="lightbox"
        ref={lightboxRef}
        tabIndex={-1}
        aria-label={product.title}
        onClose={onLightboxClose}
      >
        {visible.length > 1 ? (
          <div className="lightbox__bar">
            {visible.map((item, i) => (
              <button
                key={item.media.id ?? i}
                type="button"
                className="lightbox__segment"
                data-media-group={item.group}
                onClick={() => goToLight(i)}
                aria-current={i === lightIndex || undefined}
                aria-label={t('general.go_to_slide', {number: i + 1})}
              />
            ))}
          </div>
        ) : null}

        <button
          type="button"
          className="lightbox__close"
          onClick={() => lightboxRef.current?.close()}
          aria-label={t('general.close')}
        >
          <Icon name="icon-close" />
        </button>

        <div className="lightbox__track" ref={lightTrackRef}>
          {visible.map((item, i) => (
            <div
              key={item.media.id ?? i}
              className="lightbox__slide"
              data-media-id={item.media.id}
              data-media-group={item.group}
              onClick={onLightboxBackdrop}
            >
              <img
                className="lightbox__image"
                src={imageUrl(item.media.previewImage?.url ?? '', 2000)}
                alt={item.media.alt ?? ''}
                sizes="100vw"
                loading="lazy"
              />
            </div>
          ))}
        </div>

        {visible.length > 1 ? (
          <>
            <button
              type="button"
              className="lightbox__arrow lightbox__arrow--prev"
              onClick={() => goToLight(lightIndex - 1)}
              aria-label={t('products.previous_image')}
            >
              <Icon name="icon-chevron-left" />
            </button>
            <button
              type="button"
              className="lightbox__arrow lightbox__arrow--next"
              onClick={() => goToLight(lightIndex + 1)}
              aria-label={t('products.next_image')}
            >
              <Icon name="icon-chevron-right" />
            </button>
          </>
        ) : null}
      </dialog>
    </div>
  );
}

/**
 * Responsive preload for the first gallery image — the PDP's LCP
 * element. Same srcset/sizes as the rendered <img> so the browser
 * preloads exactly the candidate it will paint.
 */
function GalleryPreload({media}: {media: any}) {
  const preview = media?.previewImage;
  if (media?.mediaContentType !== 'IMAGE' || !preview?.url) return null;
  return (
    <link
      rel="preload"
      as="image"
      imageSrcSet={[400, 700, 1000, 1500]
        .map((w) => `${imageUrl(preview.url, w)} ${w}w`)
        .join(', ')}
      imageSizes="(min-width: 48rem) 58vw, 100vw"
      {...{fetchpriority: 'high'}}
    />
  );
}

/** One media entry in the main track, by media type. */
function GalleryMedia({
  media,
  loading,
  onZoom,
}: {
  media: any;
  loading: 'eager' | 'lazy';
  onZoom: () => void;
}) {
  const preview = media.previewImage;
  const type = media.mediaContentType;

  if (type === 'VIDEO') {
    return (
      <div className="product__media-frame">
        <video
          className="product__image"
          controls
          playsInline
          preload="metadata"
          poster={preview?.url ? imageUrl(preview.url, 1500) : undefined}
        >
          {(media.sources ?? []).map((source: any) => (
            <source key={source.url} src={source.url} type={source.mimeType} />
          ))}
        </video>
      </div>
    );
  }

  if (type === 'EXTERNAL_VIDEO') {
    return (
      <div className="product__media-frame product__media-frame--external">
        <iframe
          src={media.embedUrl}
          title={media.alt ?? 'Video'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  if (type === 'MODEL_3D') {
    // Simplification: the Liquid theme mounts Shopify's <model-viewer>;
    // here 3D models render as their preview image.
    return (
      <div className="product__media-frame">
        {preview?.url ? (
          <img
            className="product__image"
            src={imageUrl(preview.url, 1500)}
            alt={media.alt ?? ''}
            loading={loading}
          />
        ) : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      className="product__media-button"
      onClick={onZoom}
      aria-label={t('products.zoom_image')}
    >
      <img
        className="product__image"
        src={preview?.url ? imageUrl(preview.url, 1500) : undefined}
        srcSet={
          preview?.url
            ? [400, 700, 1000, 1500]
                .map((w) => `${imageUrl(preview.url, w)} ${w}w`)
                .join(', ')
            : undefined
        }
        sizes="(min-width: 48rem) 58vw, 100vw"
        width={preview?.width ?? undefined}
        height={preview?.height ?? undefined}
        loading={loading}
        // The first gallery image is the PDP's LCP candidate; lowercase
        // attribute keeps React 18 compatible.
        {...(loading === 'eager' ? {fetchpriority: 'high'} : null)}
        alt={media.alt ?? ''}
      />
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Sticky bar (mirror of <sticky-bar> in src/entries/product.ts)
 * ------------------------------------------------------------------ */

function StickyBar({
  product,
  variant,
  quantity,
}: {
  product: any;
  variant: any;
  quantity: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  // Appears once the main buy row scrolls above the viewport
  useEffect(() => {
    const target = ref.current
      ?.closest('.product__inner')
      ?.querySelector('.buy-buttons');
    if (!target) return;
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(
        entry ? !entry.isIntersecting && entry.boundingClientRect.top < 0 : false,
      );
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const available: boolean = Boolean(variant?.availableForSale);

  // The Liquid theme submits the buy-buttons form via the form
  // attribute; here the bar submits the same add-to-cart server action.
  return (
    <div className="sticky-bar" ref={ref} data-visible={visible ? '' : undefined}>
      <span className="sticky-bar__meta">
        <span className="sticky-bar__title">{product.title}</span>
      </span>
      <CartAddForm
        lines={variant ? [{merchandiseId: variant.id as string, quantity}] : []}
      >
        {({submitting}) => (
          <button
            type="submit"
            className="button sticky-bar__button"
            disabled={!available || submitting}
          >
            <span>
              {variant
                ? available
                  ? t('products.add_to_bag')
                  : t('products.sold_out')
                : t('products.unavailable')}
            </span>
            {available && variant?.price ? (
              <span className="buy-buttons__price">
                {formatMoney(multiplyMoney(variant.price, quantity))}
              </span>
            ) : null}
          </button>
        )}
      </CartAddForm>
    </div>
  );
}
