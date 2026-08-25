'use client';
/**
 * Port of sections/header.liquid (via the Hydrogen mirror) — sticky
 * header, pure-CSS mega menu, mobile menu drawer, cart count. Markup
 * and class names match the Liquid source exactly (the extracted CSS
 * is shared).
 *
 * Next.js deviations from the Hydrogen version:
 * - Cart count selects totalQuantity from the cart store
 *   (components/cart/cart-context.tsx) — 0 until the layout's streamed
 *   bootstrap resolves after hydration, then reactive to every
 *   optimistic mutation.
 * - The account link is a plain "Log in" link (no customer accounts v1).
 *
 * Dialog contract (mirror of src/lib/dialog.ts): the search and cart
 * triggers are plain anchors carrying data-dialog-open="SearchDrawer" /
 * "CartDrawer" and let the click bubble — the predictive-search and
 * cart-drawer sections register the theme's delegated document click
 * listener (registerDialogs) and preventDefault to open; the hrefs
 * (/search, /cart) stay as the no-JS fallback. The MobileMenu dialog
 * is owned by this section and opened directly.
 */
import {Suspense, useEffect, useRef} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import type {BlockData, SectionProps} from '@zalify/storefront-kit/react';
import {
  Icon,
  imageUrl,
  settingImageUrl,
  t,
  themeSettings,
  useThemeGlobals,
} from '@zalify/storefront-kit/react';
import {useCart, type CartState} from '~/components/cart/cart-context';
import {MegaPromo} from '~/components/theme/MegaPromo';
import {LocalizationSelects} from '~/components/theme/LocalizationSelects';

interface HeaderSettings {
  logo?: string;
  logo_width?: number;
  menu?: string;
  transparent_home?: boolean;
  transparent_foreground?: string;
}

interface MenuItem {
  id?: string;
  title: string;
  url?: string | null;
  items?: MenuItem[];
}

interface HeaderData {
  shop?: {
    name?: string;
    primaryDomain?: {url?: string};
  };
  menu?: {items?: MenuItem[]} | null;
}

const selectTotalQuantity = (state: CartState) => state.data.totalQuantity ?? 0;

/**
 * Reactive count from the cart store: 0 through the server render and
 * hydration, then the bootstrapped cart, then every optimistic
 * mutation as it happens.
 */
function CartCountValue() {
  return <>{useCart(selectTotalQuantity)}</>;
}

/* Standard header row height, published for pure-CSS layout math
   (--header-stack in critical.css) — mirror of the section's {% style %}. */
const HEIGHT_TOKEN_CSS = `
:root {
  --header-height: 3.5rem;
}
`;

/**
 * Cache Components: usePathname() is runtime data on unknown-param
 * routes, and the header renders in the layout's static shell. The
 * pathname-aware header therefore sits under <Suspense> whose
 * fallback is the SAME header rendered solid (pathname=null): on
 * static routes (/, /cart, …) the pathname is known at prerender and
 * the real header lands in the shell; on param routes the solid
 * fallback is in the shell (those are never the home page) and the
 * pathname-aware render streams in.
 */
export default function HeaderSection(props: SectionProps<HeaderSettings>) {
  return (
    <Suspense fallback={<HeaderImpl {...props} pathname={null} />}>
      <HeaderWithPathname {...props} />
    </Suspense>
  );
}

function HeaderWithPathname(props: SectionProps<HeaderSettings>) {
  const pathname = usePathname();
  return <HeaderImpl {...props} pathname={pathname} />;
}

function HeaderImpl({
  section,
  settings,
  pathname,
}: SectionProps<HeaderSettings> & {pathname: string | null}) {
  const globals = useThemeGlobals();
  const headerData = globals.header as HeaderData | undefined;
  const shopName = themeSettings.brand_name || (headerData?.shop?.name ?? '');
  const primaryDomainUrl = headerData?.shop?.primaryDomain?.url ?? '';
  const publicStoreDomain = globals.publicStoreDomain ?? '';
  const menuItems = headerData?.menu?.items ?? [];

  // Mirror of `template.name == 'index'` — home page, incl. locale prefix.
  const isHome =
    pathname === '/' ||
    (pathname != null && /^\/[a-zA-Z]{2}-[a-zA-Z]{2}\/?$/.test(pathname));
  const transparent = Boolean(settings.transparent_home) && isHome;

  const logo = settingImageUrl(settings.logo);
  const logoWidth = settings.logo_width ?? 130;

  const headerRef = useRef<HTMLElement>(null);
  const mobileMenuRef = useRef<HTMLDialogElement>(null);

  /** Resolve a menu URL to a relative path (Storefront API URLs are absolute). */
  const toHref = (url?: string | null): string => {
    if (!url) return '#';
    if (
      url.includes('myshopify.com') ||
      (publicStoreDomain && url.includes(publicStoreDomain)) ||
      (primaryDomainUrl && url.includes(primaryDomainUrl))
    ) {
      try {
        return new URL(url).pathname;
      } catch {
        return url;
      }
    }
    return url;
  };

  /* Mirror of Shopify's section wrapper class ({% schema %} "class":
     "section-header"): the sticky/transparent CSS targets the wrapper,
     which the theme engine renders above this component, so the class
     is attached on mount. Also ports critical.ts's trackHeaderOffset:
     publish the MEASURED height of everything above the page content
     as --header-offset (sticky `top` offsets that must track the real
     rendered header). Section HEIGHTS use --header-stack instead. */
  useEffect(() => {
    const wrapper = headerRef.current?.closest<HTMLElement>('.shopify-section');
    if (!wrapper) return;
    wrapper.classList.add('section-header');

    let last = '';
    const update = (): void => {
      // Sum of rendered heights only; never offsetTop (sticky poisons it).
      let offset = wrapper.offsetHeight;
      let prev = wrapper.previousElementSibling;
      while (prev instanceof HTMLElement) {
        // Only in-flow sections count toward the stack.
        if (prev.classList.contains('shopify-section')) {
          offset += prev.offsetHeight;
        }
        prev = prev.previousElementSibling;
      }
      const value = `${Math.round(offset)}px`;
      if (value === last) return;
      last = value;
      document.documentElement.style.setProperty('--header-offset', value);
    };
    const observer = new ResizeObserver(update);
    observer.observe(wrapper);
    observer.observe(document.body);
    update();
    return () => {
      observer.disconnect();
      wrapper.classList.remove('section-header');
    };
  }, []);

  /* Transparent header (home page): mirror of critical.ts's
     trackTransparentHeader — solid as soon as content moves under it. */
  useEffect(() => {
    const wrapper = headerRef.current?.closest<HTMLElement>('.shopify-section');
    if (!wrapper || !transparent) return;
    const update = (): void => {
      wrapper.classList.toggle('is-scrolled', window.scrollY > 8);
    };
    window.addEventListener('scroll', update, {passive: true});
    update();
    return () => {
      window.removeEventListener('scroll', update);
      wrapper.classList.remove('is-scrolled');
    };
  }, [transparent]);

  const openMobileMenu = () => {
    const dialog = mobileMenuRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  };
  const closeMobileMenu = () => mobileMenuRef.current?.close();

  /* The mega panel is pure CSS (:hover/:focus-within), and a
     client-side navigation resets neither — the panel would stay open
     on the new page. Clicking any link inside suppresses it until the
     pointer leaves the dropdown; blur kills the :focus-within leg. */
  const suppressMegaOnNavigate = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!(event.target instanceof Element) || !event.target.closest('a')) {
      return;
    }
    const dropdown = event.currentTarget;
    dropdown.classList.add('header__dropdown--suppressed');
    const active = document.activeElement;
    if (active instanceof HTMLElement && dropdown.contains(active)) {
      active.blur();
    }
    dropdown.addEventListener(
      'mouseleave',
      () => dropdown.classList.remove('header__dropdown--suppressed'),
      {once: true},
    );
  };

  /* One promo block per menu item; titles compared case-insensitively
     with whitespace stripped (mirror of the Liquid block lookup). */
  const promoBlocks = (section.block_order ?? [])
    .map((key) => section.blocks?.[key])
    .filter(
      (block): block is BlockData =>
        Boolean(block && !block.disabled && block.type === 'mega_promo'),
    );
  const promoFor = (title: string): BlockData | undefined => {
    const key = title.trim().toLowerCase();
    if (!key) return undefined;
    return promoBlocks.find(
      (block) =>
        String((block.settings?.menu_item as string) ?? '')
          .trim()
          .toLowerCase() === key,
    );
  };

  const accountLink = (className: string) => (
    <a href="/account" className={className}>
      {t('general.log_in')}
    </a>
  );

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: HEIGHT_TOKEN_CSS}} />
      <header
        ref={headerRef}
        className={`header${transparent ? ' header--transparent' : ''}`}
        style={
          transparent
            ? ({
                '--color-header-transparent':
                  settings.transparent_foreground ?? '#FFFFFF',
              } as React.CSSProperties)
            : undefined
        }
      >
        <div
          className="header__logo"
          style={{'--logo-width': `${logoWidth}px`} as React.CSSProperties}
        >
          {logo ? (
            <Link href="/">
              <img
                className="header__logo-image"
                src={imageUrl(logo, logoWidth * 2)}
                alt={shopName}
              />
            </Link>
          ) : (
            <Link href="/" className="header__logo-text">
              {shopName}
            </Link>
          )}
        </div>

        <nav className="header__nav" aria-label={t('general.menu')}>
          {menuItems.map((link) => {
            const children = link.items ?? [];
            if (children.length === 0) {
              return (
                <Link
                  key={link.id ?? link.title}
                  className="header__link"
                  href={toHref(link.url)}
                >
                  {link.title}
                </Link>
              );
            }
            const looseLinks = children.filter(
              (child) => (child.items ?? []).length === 0,
            );
            const groups = children.filter(
              (child) => (child.items ?? []).length > 0,
            );
            const promoBlock = promoFor(link.title);
            return (
              // Delegation only: the anchors inside are the interactive
              // elements, and their keyboard activation fires the same
              // bubbling click.
              // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
              <div
                key={link.id ?? link.title}
                className="header__dropdown"
                onClick={suppressMegaOnNavigate}
              >
                <Link className="header__link" href={toHref(link.url)}>
                  {link.title}
                </Link>
                <div className="header__mega">
                  <div className="header__mega-inner">
                    <div className="header__mega-columns">
                      {looseLinks.length > 0 && (
                        <ul className="header__mega-list stack" role="list">
                          {looseLinks.map((child) => (
                            <li key={child.id ?? child.title}>
                              <Link
                                className="header__mega-link"
                                href={toHref(child.url)}
                              >
                                {child.title}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}

                      {groups.map((child) => (
                        <div
                          key={child.id ?? child.title}
                          className="header__mega-group stack"
                        >
                          <Link
                            className="header__mega-heading"
                            href={toHref(child.url)}
                          >
                            {child.title}
                          </Link>
                          <ul className="header__mega-list stack" role="list">
                            {(child.items ?? []).map((grandchild) => (
                              <li key={grandchild.id ?? grandchild.title}>
                                <Link
                                  className="header__mega-link"
                                  href={toHref(grandchild.url)}
                                >
                                  {grandchild.title}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>

                    {promoBlock && (
                      <div className="header__mega-promos mega-promos-row">
                        <MegaPromo block={promoBlock} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>

        <div className="header__icons">
          <a
            href="/search"
            className="header__icon-button"
            data-dialog-open="SearchDrawer"
            aria-label={t('search.title')}
          >
            <Icon name="icon-search" />
          </a>

          {accountLink('header__text-button header__account')}

          <button
            type="button"
            className="header__text-button header__menu-text"
            data-dialog-open="MobileMenu"
            onClick={openMobileMenu}
          >
            {t('general.menu')}
          </button>

          <a
            href="/cart"
            className="header__text-button"
            data-dialog-open="CartDrawer"
          >
            {t('cart.bag')}
            <span className="header__bag-count">
              (
              <cart-count>
                {/* Reactive to the cart store: hydrates from the
                    layout's streamed bootstrap, then updates
                    optimistically on every mutation. */}
                <CartCountValue />
              </cart-count>
              )
            </span>
          </a>
        </div>
      </header>

      <div id="MobileMenu">
        <dialog
          ref={mobileMenuRef}
          scroll-lock=""
          className="drawer drawer--start"
          aria-label={t('general.menu')}
          onClick={(event) => {
            // Light dismiss: clicks land on the <dialog> itself only
            // when they hit the backdrop (mirror of src/lib/dialog.ts).
            if (event.target === mobileMenuRef.current) closeMobileMenu();
          }}
        >
          <header className="drawer__header cluster">
            <p className="drawer__title">{t('general.menu')}</p>
            <button
              type="button"
              className="drawer__close"
              data-dialog-close=""
              aria-label={t('general.close')}
              onClick={closeMobileMenu}
            >
              <Icon name="icon-close" />
            </button>
          </header>
          <nav className="drawer__body mobile-menu" aria-label={t('general.menu')}>
            <ul className="mobile-menu__list" role="list">
              {menuItems.map((link) => {
                const children = link.items ?? [];
                const promoBlock = promoFor(link.title);
                return (
                  <li key={link.id ?? link.title} className="mobile-menu__item">
                    {children.length > 0 ? (
                      <details className="mobile-menu__group">
                        <summary className="mobile-menu__row">
                          <span>{link.title}</span>
                          <span
                            className="mobile-menu__toggle"
                            aria-hidden="true"
                          ></span>
                        </summary>
                        <ul className="mobile-menu__sublist" role="list">
                          {children.map((child) => (
                            <li key={child.id ?? child.title}>
                              {(child.items ?? []).length > 0 ? (
                                <details className="mobile-menu__group">
                                  <summary className="mobile-menu__row mobile-menu__row--sub">
                                    <span>{child.title}</span>
                                    <span
                                      className="mobile-menu__toggle"
                                      aria-hidden="true"
                                    ></span>
                                  </summary>
                                  <ul
                                    className="mobile-menu__sublist mobile-menu__sublist--nested"
                                    role="list"
                                  >
                                    {(child.items ?? []).map((grandchild) => (
                                      <li key={grandchild.id ?? grandchild.title}>
                                        <Link
                                          className="mobile-menu__row mobile-menu__row--sub"
                                          href={toHref(grandchild.url)}
                                          onClick={closeMobileMenu}
                                        >
                                          {grandchild.title}
                                        </Link>
                                      </li>
                                    ))}
                                  </ul>
                                </details>
                              ) : (
                                <Link
                                  className="mobile-menu__row mobile-menu__row--sub"
                                  href={toHref(child.url)}
                                  onClick={closeMobileMenu}
                                >
                                  {child.title}
                                </Link>
                              )}
                            </li>
                          ))}
                        </ul>

                        {promoBlock && (
                          <div className="mobile-menu__promos mega-promos-row">
                            <MegaPromo block={promoBlock} />
                          </div>
                        )}
                      </details>
                    ) : (
                      <Link
                        className="mobile-menu__row"
                        href={toHref(link.url)}
                        onClick={closeMobileMenu}
                      >
                        {link.title}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>

            <div className="mobile-menu__utility">
              {accountLink('mobile-menu__utility-link')}

              <div className="mobile-menu__locale">
                <LocalizationSelects
                  idPrefix="MobileMenu"
                  showCountry
                  showLocale
                />
              </div>
            </div>
          </nav>
        </dialog>
      </div>
    </>
  );
}
