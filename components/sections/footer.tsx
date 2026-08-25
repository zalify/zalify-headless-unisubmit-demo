'use client';
/**
 * Port of sections/footer.liquid (via the Hydrogen mirror) — brand
 * column, menu disclosure columns, newsletter signup, localization
 * selects, payment icons and legal row.
 * CSS: app/styles/components/sections-footer.css
 *
 * Next.js deviation: the footer menu arrives resolved from the server
 * layout (globals.footer), no deferred promise / <Await>.
 */
import {useEffect, useState} from 'react';
import Link from 'next/link';
import type {SectionProps} from '@zalify/storefront-kit/react';
import {
  Icon,
  imageUrl,
  settingImageUrl,
  t,
  themeSettings,
  useThemeGlobals,
} from '@zalify/storefront-kit/react';
import type {IconName} from '@zalify/storefront-kit/react';
import {LocalizationSelects} from '~/components/theme/LocalizationSelects';
import {PaymentIcons} from '~/components/theme/PaymentIcons';

interface FooterSettings {
  logo?: string;
  logo_width?: number;
  text?: string;
  menu?: string;
  secondary_menu?: string;
  show_newsletter?: boolean;
  show_payment_icons?: boolean;
  show_country_selector?: boolean;
  show_locale_selector?: boolean;
  enable_follow_on_shop?: boolean;
  color_scheme?: string;
  section_spacing?: 'none' | 'sm' | 'md' | 'lg';
}

interface MenuItem {
  id?: string;
  title: string;
  url?: string | null;
  items?: MenuItem[];
}

interface FooterData {
  menu?: {items?: MenuItem[]} | null;
  secondaryMenu?: {items?: MenuItem[]} | null;
}

const SOCIAL_LINKS: Array<{
  id: string;
  icon: IconName;
  label: string;
}> = [
  {id: 'social_instagram', icon: 'icon-instagram', label: 'Instagram'},
  {id: 'social_tiktok', icon: 'icon-tiktok', label: 'TikTok'},
  {id: 'social_x', icon: 'icon-x', label: 'X'},
  {id: 'social_facebook', icon: 'icon-facebook', label: 'Facebook'},
  {id: 'social_youtube', icon: 'icon-youtube', label: 'YouTube'},
  {id: 'social_pinterest', icon: 'icon-pinterest', label: 'Pinterest'},
];

export default function FooterSection({
  id,
  settings,
}: SectionProps<FooterSettings>) {
  const {
    logo_width: logoWidth = 130,
    text = '',
    menu = 'footer',
    show_newsletter: showNewsletter = true,
    show_payment_icons: showPaymentIcons = true,
    show_country_selector: showCountrySelector = true,
    show_locale_selector: showLocaleSelector = true,
    color_scheme: colorScheme = 'scheme-3',
    section_spacing: sectionSpacing = 'lg',
  } = settings;

  const globals = useThemeGlobals();
  const headerData = globals.header as
    | {shop?: {name?: string; primaryDomain?: {url?: string}}}
    | undefined;
  const shopName = themeSettings.brand_name || (headerData?.shop?.name ?? '');
  const primaryDomainUrl = headerData?.shop?.primaryDomain?.url ?? '';
  const publicStoreDomain = globals.publicStoreDomain ?? '';
  const footerData = globals.footer as FooterData | null | undefined;

  const logo = settingImageUrl(settings.logo);

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

  const socials = SOCIAL_LINKS.map(({id: settingId, icon, label}) => ({
    icon,
    label,
    url:
      typeof themeSettings[settingId] === 'string'
        ? (themeSettings[settingId] as string)
        : '',
  })).filter((social) => social.url !== '');

  // Menu title in Liquid is the linklist's title; the Storefront menu
  // query has no title, so the handle from settings fills in.
  const menuTitle = menu ? menu.charAt(0).toUpperCase() + menu.slice(1) : '';
  const menuItems = footerData?.menu?.items ?? [];
  const secondaryItems =
    settings.secondary_menu === ''
      ? []
      : (footerData?.secondaryMenu?.items ?? []);
  // A 2-level footer menu renders one column per top-level item
  // (heading = item title); a flat menu keeps the single column.
  const menuHasChildren = menuItems.some((item) => item.items?.length);

  return (
    <footer
      className={`footer section color-${colorScheme} full-width`}
      style={
        {
          '--section-spacing': `var(--space-section-${sectionSpacing})`,
        } as React.CSSProperties
      }
    >
      <div className="footer__inner">
        <div className="footer__grid">
          <div
            className="footer__brand stack"
            style={{'--stack-gap': 'var(--space-md)'} as React.CSSProperties}
          >
            {logo ? (
              <Link
                href="/"
                className="footer__logo"
                style={{'--logo-width': `${logoWidth}px`} as React.CSSProperties}
              >
                <img
                  className="footer__logo-image"
                  src={imageUrl(logo, logoWidth * 2)}
                  alt={shopName}
                  loading="lazy"
                />
              </Link>
            ) : (
              <p className="footer__shop-name">{shopName}</p>
            )}
            {text !== '' && (
              <div
                className="footer__text"
                dangerouslySetInnerHTML={{__html: text}}
              />
            )}

            {socials.length > 0 && (
              <ul className="footer__social" role="list">
                {socials.map((social) => (
                  <li key={social.label}>
                    <a
                      className="footer__social-link"
                      href={social.url}
                      aria-label={social.label}
                    >
                      <Icon name={social.icon} />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {((menu !== '' && menuItems.length > 0) ||
            secondaryItems.length > 0) && (
            <div className="footer__menus">
              {menu !== '' &&
                menuItems.length > 0 &&
                (menuHasChildren ? (
                  menuItems.map((item) => (
                    <MenuColumn
                      key={item.id ?? item.title}
                      title={item.title}
                      links={
                        item.items?.length
                          ? item.items
                          : [{id: item.id, title: item.title, url: item.url}]
                      }
                      toHref={toHref}
                    />
                  ))
                ) : (
                  <MenuColumn
                    title={menuTitle}
                    links={menuItems}
                    toHref={toHref}
                  />
                ))}
              {secondaryItems.length > 0 && (
                <MenuColumn
                  title={t('general.footer_navigation')}
                  links={secondaryItems}
                  toHref={toHref}
                />
              )}
            </div>
          )}

          {showNewsletter && <Newsletter sectionId={id} />}
        </div>

        {(showCountrySelector || showLocaleSelector) && (
          <div
            className="footer__utility cluster"
            style={{'--cluster-gap': 'var(--space-md)'} as React.CSSProperties}
          >
            <LocalizationSelects
              idPrefix={`Footer-${id}`}
              showCountry={showCountrySelector}
              showLocale={showLocaleSelector}
            />
          </div>
        )}

        <div className="footer__bottom cluster">
          <small>
            &copy; <CopyrightYear /> {shopName}
          </small>
          {showPaymentIcons && <PaymentIcons />}
          <small>
            <a
              href="https://www.zalify.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              Powered by Zalify
            </a>
          </small>
        </div>
      </div>
    </footer>
  );
}

function MenuColumn({
  title,
  links,
  toHref,
}: {
  title: string;
  links: MenuItem[];
  toHref: (url?: string | null) => string;
}) {
  return (
    <nav className="footer__menu" aria-label={t('general.footer_navigation')}>
      <details className="footer__disclosure">
        <summary className="footer__heading">{title}</summary>
        <ul
          className="stack"
          role="list"
          style={{'--stack-gap': 'var(--space-sm)'} as React.CSSProperties}
        >
          {links.map((link) => (
            <li key={link.id ?? link.title}>
              <Link className="footer__link" href={toHref(link.url)}>
                {link.title}
              </Link>
            </li>
          ))}
        </ul>
      </details>
    </nav>
  );
}

/**
 * Newsletter signup — visual approximation of `{% form 'customer' %}`:
 * the Liquid customer form endpoint doesn't exist here, so the submit
 * is intercepted and the success message shown locally.
 */
function Newsletter({sectionId}: {sectionId: string}) {
  const [posted, setPosted] = useState(false);
  return (
    <div
      className="footer__newsletter stack"
      style={{'--stack-gap': 'var(--space-sm)'} as React.CSSProperties}
    >
      <p className="footer__newsletter-heading">{t('newsletter.heading')}</p>
      <form
        className="footer__newsletter-form"
        onSubmit={(event) => {
          event.preventDefault();
          setPosted(true);
        }}
      >
        <input type="hidden" name="contact[tags]" value="newsletter" />
        <div className="footer__newsletter-row">
          <label
            className="visually-hidden"
            htmlFor={`NewsletterEmail-${sectionId}`}
          >
            {t('newsletter.email')}
          </label>
          <input
            id={`NewsletterEmail-${sectionId}`}
            type="email"
            name="contact[email]"
            required
            placeholder={t('newsletter.email')}
            autoComplete="email"
          />
          <button type="submit" className="button">
            {t('newsletter.submit')}
          </button>
        </div>
        {posted && (
          <p className="footer__newsletter-message">
            {t('newsletter.success')}
          </p>
        )}
      </form>
    </div>
  );
}

/**
 * Copyright year, resolved client-side: under Cache Components the
 * footer is part of the prerendered static shell, where `new Date()`
 * is runtime data (next-prerender-current-time-client). The year
 * fills in after hydration — an empty placeholder in the shell HTML.
 */
function CopyrightYear() {
  const [year, setYear] = useState<number | null>(null);
  useEffect(() => setYear(new Date().getFullYear()), []);
  return <>{year}</>;
}
