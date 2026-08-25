/**
 * Global not-found (URLs matching no route at all). Renders under the
 * bare root layout, so it mounts the default store's StoreLayout itself
 * to get the theme providers + header/footer around the 404 template.
 * Tenant hosts rarely reach this: unknown paths under /s/[store] are
 * caught by app/s/[store]/[...notFound] and render in the store's own
 * layout instead.
 */
import StoreLayout from '~/components/StoreLayout';
import {defaultStoreConfig} from '~/lib/store-config';
import ThemeTemplateClient from '~/components/ThemeTemplateClient';

export default function NotFound() {
  return (
    <StoreLayout store={defaultStoreConfig}>
      <ThemeTemplateClient name="404" />
    </StoreLayout>
  );
}
