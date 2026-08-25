/**
 * Storefront API fragments/queries shared by the server (route pages,
 * section loaders, cart actions).
 *
 * PRODUCT_CARD_FRAGMENT is a verbatim copy of the one exported by
 * '@zalify/storefront-kit/react' (src/components/ProductCard.tsx). It must be kept
 * in sync manually: Next's server-component graph resolves `react`
 * under the `react-server` condition (no client hooks), so server code
 * cannot import '@zalify/storefront-kit/react' — its entry point transitively pulls
 * hook-using components. Client components import the canonical export.
 */

export const PRODUCT_CARD_FRAGMENT = `#graphql
  fragment ProductCardVariant on ProductVariant {
    id
    availableForSale
    image {
      id
      url
      altText
      width
      height
    }
    price { amount currencyCode }
    compareAtPrice { amount currencyCode }
    unitPrice { amount currencyCode }
    unitPriceMeasurement { referenceValue referenceUnit }
    selectedOptions { name value }
  }
  fragment ProductCard on Product {
    id
    handle
    title
    vendor
    tags
    availableForSale
    featuredImage {
      id
      url
      altText
      width
      height
    }
    images(first: 2) {
      nodes {
        id
        url
        altText
        width
        height
      }
    }
    priceRange {
      minVariantPrice { amount currencyCode }
      maxVariantPrice { amount currencyCode }
    }
    compareAtPriceRange {
      minVariantPrice { amount currencyCode }
      maxVariantPrice { amount currencyCode }
    }
    options {
      name
      optionValues {
        name
        swatch {
          color
          image {
            previewImage { url }
          }
        }
        firstSelectableVariant {
          ...ProductCardVariant
        }
      }
    }
    selectedOrFirstAvailableVariant {
      ...ProductCardVariant
    }
    variants(first: 50) {
      nodes {
        ...ProductCardVariant
      }
    }
    rating: metafield(namespace: "reviews", key: "rating") {
      value
    }
    ratingCount: metafield(namespace: "reviews", key: "rating_count") {
      value
    }
  }
` as const;

/* -------------------- menus (header/footer globals) -------------------- */

const MENU_FRAGMENT = `#graphql
  fragment MenuItem on MenuItem {
    id
    resourceId
    tags
    title
    type
    url
  }
  fragment GrandchildMenuItem on MenuItem {
    ...MenuItem
  }
  fragment ChildMenuItem on MenuItem {
    ...MenuItem
    items {
      ...GrandchildMenuItem
    }
  }
  fragment ParentMenuItem on MenuItem {
    ...MenuItem
    items {
      ...ChildMenuItem
    }
  }
  fragment Menu on Menu {
    id
    items {
      ...ParentMenuItem
    }
  }
` as const;

export const HEADER_QUERY = `#graphql
  fragment Shop on Shop {
    id
    name
    description
    primaryDomain {
      url
    }
  }
  query Header($headerMenuHandle: String!) {
    shop {
      ...Shop
    }
    menu(handle: $headerMenuHandle) {
      ...Menu
    }
  }
  ${MENU_FRAGMENT}
` as const;

export const FOOTER_QUERY = `#graphql
  query Footer($footerMenuHandle: String!) {
    menu(handle: $footerMenuHandle) {
      ...Menu
    }
    # Optional second footer menu (footer.secondary_menu setting); menus
    # that don't exist resolve to null with no error.
    secondaryMenu: menu(handle: "footer-secondary") {
      ...Menu
    }
  }
  ${MENU_FRAGMENT}
` as const;

/* ------------------------------ cart ------------------------------ */

export const CART_FRAGMENT = `#graphql
  fragment CartMoney on MoneyV2 {
    currencyCode
    amount
  }
  fragment CartDiscountAllocation on CartDiscountAllocation {
    discountedAmount {
      ...CartMoney
    }
    ... on CartCodeDiscountAllocation {
      code
    }
    ... on CartAutomaticDiscountAllocation {
      title
    }
    ... on CartCustomDiscountAllocation {
      title
    }
  }
  fragment CartLine on CartLine {
    id
    quantity
    discountAllocations {
      ...CartDiscountAllocation
    }
    attributes {
      key
      value
    }
    cost {
      totalAmount {
        ...CartMoney
      }
      amountPerQuantity {
        ...CartMoney
      }
      compareAtAmountPerQuantity {
        ...CartMoney
      }
    }
    merchandise {
      ... on ProductVariant {
        id
        availableForSale
        compareAtPrice {
          ...CartMoney
        }
        price {
          ...CartMoney
        }
        requiresShipping
        sku
        title
        image {
          id
          url
          altText
          width
          height
        }
        product {
          handle
          title
          id
          vendor
        }
        selectedOptions {
          name
          value
        }
      }
    }
  }
  fragment CartApiQuery on Cart {
    updatedAt
    id
    checkoutUrl
    totalQuantity
    note
    lines(first: $numCartLines) {
      nodes {
        ...CartLine
      }
    }
    cost {
      subtotalAmount {
        ...CartMoney
      }
      totalAmount {
        ...CartMoney
      }
      totalTaxAmount {
        ...CartMoney
      }
    }
    discountCodes {
      code
      applicable
    }
    discountAllocations {
      ...CartDiscountAllocation
    }
  }
` as const;
