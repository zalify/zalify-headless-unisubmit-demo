'use client';
/**
 * Client wrapper for the storefront-kit engine's <ThemeTemplate> — the
 * engine renders through React context (registries, template scope), so
 * it must live in the client-module graph. Server pages pass the route
 * resources and section-loader results as serializable props.
 *
 * Canvas-editor integration (selection, hot template apply) lives in
 * useEditorTemplate — a no-op returning null outside the editor.
 */
import '~/lib/theme-setup';
import {useEffect} from 'react';
import {
  RenderSections,
  TemplateProvider,
  ThemeTemplate,
} from '@zalify/storefront-kit/react';
import {useEditorTemplate} from '~/components/useEditorTemplate';
import {publishPixelResources} from '~/lib/pixel-resources';

export default function ThemeTemplateClient({
  name,
  resources,
  sectionData,
}: {
  name: string;
  resources?: Record<string, unknown>;
  sectionData?: Record<string, unknown>;
}) {
  const applied = useEditorTemplate(name);

  // Route resources → the pixel bridge (PixelEvents lives outside the
  // template context; see lib/pixel-resources.ts).
  useEffect(() => {
    publishPixelResources(resources ?? {});
  }, [resources]);

  if (applied) {
    return (
      <TemplateProvider
        value={{
          name,
          kind: 'template',
          resources: resources ?? {},
          sectionData: sectionData ?? {},
        }}
      >
        <RenderSections template={applied} scope={{kind: 'template', name}} />
      </TemplateProvider>
    );
  }
  return (
    <ThemeTemplate name={name} resources={resources} sectionData={sectionData} />
  );
}
