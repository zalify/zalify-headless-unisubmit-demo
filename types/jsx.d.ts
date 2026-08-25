/**
 * React 19 type bridges for code written against @types/react 18.
 *
 * - Custom elements: the theme wraps the header cart count in
 *   <cart-count>, and @zalify/storefront-kit/react's announcement-bar section
 *   renders an <announcement-bar> element (declared there via the
 *   React-18 global JSX namespace, which React 19's checker ignores).
 *   React 19 resolves IntrinsicElements from the react module's JSX
 *   namespace, so both are declared here.
 * - useRef overload: @zalify/storefront-kit/react calls `useRef<T>()` with no
 *   initial value (legal under @types/react 18); React 19 made the
 *   argument required, so the 18-style overload is restored for this
 *   program only.
 */
import type * as React from 'react';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'cart-count': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      'announcement-bar': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
    }
  }

  function useRef<T>(): React.MutableRefObject<T | undefined>;
}
