/**
 * notFound() boundary for the single-tenant tree — renders the theme's
 * 404 template inside the (default) store layout.
 */
import ThemeTemplateClient from '~/components/ThemeTemplateClient';

export default function NotFound() {
  return <ThemeTemplateClient name="404" />;
}
