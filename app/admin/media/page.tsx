import type { Metadata } from 'next';
import { MediaLibrary } from '@/components/admin/media-library';
import { PageTitle } from '@/components/admin/ui';
import { requirePerm } from '@/lib/admin/db';

export const metadata: Metadata = { title: 'Media library' };

export default async function MediaPage() {
  await requirePerm(['content', 'catalogue'], '/admin/media');
  return (
    <>
      <PageTitle title="Media library" sub="Every image uploaded for your shop and website. Add descriptions for screen readers and search engines, find where an image is used, and remove ones you no longer need." />
      <MediaLibrary />
    </>
  );
}
