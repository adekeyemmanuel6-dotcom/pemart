import type { Metadata } from 'next';
import { PresaleForm } from '@/components/presale/presale-form';
import { PresaleLayout, PresalePoster } from '@/components/presale/presale-poster';
import { Button } from '@/components/ui/button';
import { NIGERIAN_STATES } from '@/lib/shipping';
import { GARMENT_LABEL, presaleState } from '@/lib/presale/schema';
import { getPresaleConfig } from '@/lib/presale/server';
import { getSettings } from '@/lib/settings';
import { whatsappLink } from '@/lib/site';

export const revalidate = 300;
export async function generateMetadata(): Promise<Metadata> {
  const c = await getPresaleConfig();
  return { title: c.headline || 'Pre-sale', description: c.subhead.slice(0, 160), alternates: { canonical: '/presale' }, robots: presaleState(c) === 'off' ? { index: false } : undefined };
}

export default async function PresalePage() {
  const [config, settings] = await Promise.all([getPresaleConfig(), getSettings()]);
  const state = presaleState(config);
  const garments = config.garments.map((id) => ({ id, label: config.garmentLabels[id] || GARMENT_LABEL[id] }));
  return (
    <PresaleLayout poster={<PresalePoster config={config} />}>
      {state === 'open' ? (
        <PresaleForm garments={garments} states={[...NIGERIAN_STATES]} notesHelp={config.notesHelp} notice={config.notice} />
      ) : (
        <div className="mx-auto max-w-md py-10 text-center" role="status">
          <h2 className="display text-4xl">{state === 'soon' ? 'Opening soon' : 'Pre-sale is closed'}</h2>
          <p className="mt-3 text-lg text-muted">{state === 'soon' && config.startsOn ? `Pre-sale opens on ${new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'long', timeZone: 'Africa/Lagos' }).format(new Date(`${config.startsOn}T12:00:00+01:00`))}.` : config.closedText}</p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild><a href={whatsappLink(settings.whatsapp_number, 'Hi, I would like to know about the pre-sale.')} target="_blank" rel="noopener noreferrer">Message us on WhatsApp</a></Button>
          </div>
        </div>
      )}
    </PresaleLayout>
  );
}
