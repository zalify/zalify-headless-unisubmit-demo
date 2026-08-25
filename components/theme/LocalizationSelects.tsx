'use client';
/**
 * Port of snippets/localization-selects.liquid (via the Hydrogen
 * mirror) — country/currency and language selectors using the shared
 * .select primitive. Callers decide visibility.
 * CSS: app/styles/components/snippets-localization-selects.css
 *
 * NOTE: a visual approximation. Liquid renders auto-submitting
 * `{% form 'localization' %}` forms over `localization.available_*`;
 * this template has no localization data source (documented v1 gap),
 * so each select shows a single option for the store's current
 * locale/currency, derived from a `/xx-yy` URL prefix when present.
 *
 * Cache Components: the selects render in the layout's static shell
 * (header mobile menu + footer), where usePathname() would be runtime
 * data on unknown-param routes. Since no locale-prefixed routes are
 * routed in v1, the prefix is read from window.location after mount
 * instead (en/US default in the shell).
 */
import {useEffect, useState} from 'react';
import {t} from '@zalify/storefront-kit/react';

const CURRENCY_BY_COUNTRY: Record<string, {code: string; symbol: string}> = {
  US: {code: 'USD', symbol: '$'},
  CA: {code: 'CAD', symbol: '$'},
  GB: {code: 'GBP', symbol: '£'},
  AU: {code: 'AUD', symbol: '$'},
  NZ: {code: 'NZD', symbol: '$'},
  JP: {code: 'JPY', symbol: '¥'},
  DE: {code: 'EUR', symbol: '€'},
  FR: {code: 'EUR', symbol: '€'},
  IT: {code: 'EUR', symbol: '€'},
  ES: {code: 'EUR', symbol: '€'},
  NL: {code: 'EUR', symbol: '€'},
  IE: {code: 'EUR', symbol: '€'},
};

function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(['en'], {type: 'region'}).of(code) ?? code;
  } catch {
    return code;
  }
}

function languageEndonym(code: string): string {
  try {
    const name =
      new Intl.DisplayNames([code], {type: 'language'}).of(code) ?? code;
    // Mirror of `| capitalize`
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    return code.toUpperCase();
  }
}

export function LocalizationSelects({
  idPrefix,
  showCountry = false,
  showLocale = false,
}: {
  idPrefix: string;
  showCountry?: boolean;
  showLocale?: boolean;
}) {
  const [pathname, setPathname] = useState('/');
  useEffect(() => setPathname(window.location.pathname), []);
  const match = pathname.match(/^\/([a-zA-Z]{2})-([a-zA-Z]{2})(\/|$)/);
  const language = (match?.[1] ?? 'en').toLowerCase();
  const country = (match?.[2] ?? 'US').toUpperCase();
  const currency = CURRENCY_BY_COUNTRY[country];

  return (
    <>
      {showCountry && (
        <form className="localization-form">
          <label className="visually-hidden" htmlFor={`${idPrefix}-country`}>
            {t('general.country')}
          </label>
          <span className="select">
            <select
              id={`${idPrefix}-country`}
              name="country_code"
              defaultValue={country}
            >
              <option value={country}>
                {countryName(country)}
                {currency ? ` (${currency.code} ${currency.symbol})` : ''}
              </option>
            </select>
          </span>
        </form>
      )}

      {showLocale && (
        <form className="localization-form">
          <label className="visually-hidden" htmlFor={`${idPrefix}-locale`}>
            {t('general.language')}
          </label>
          <span className="select">
            <select
              id={`${idPrefix}-locale`}
              name="locale_code"
              defaultValue={language}
            >
              <option value={language}>{languageEndonym(language)}</option>
            </select>
          </span>
        </form>
      )}
    </>
  );
}
