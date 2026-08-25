/**
 * notFound() boundary for the tenant tree — renders the theme's 404
 * template inside the store's own layout (header/footer intact).
 */
import ThemeTemplateClient from '~/components/ThemeTemplateClient';

export default function NotFound() {
  return <ThemeTemplateClient name="404" />;
}
