'use client';
import { DEFAULT_SECTION_STYLE, type SectionStyle } from '@/lib/website/schema';
import { inputCls } from './ui';

const OPTIONS: { key: keyof SectionStyle; label: string; choices: [string, string][] }[] = [
  { key: 'headingFont', label: 'Heading font', choices: [['default', 'Site default'], ['display', 'Bold condensed (Anton)'], ['sans', 'Clean sans serif'], ['serif', 'Classic serif']] },
  { key: 'headingCase', label: 'Heading letters', choices: [['default', 'Site default'], ['upper', 'ALL CAPITALS'], ['none', 'As typed']] },
  { key: 'headingSize', label: 'Heading size', choices: [['default', 'Default'], ['s', 'Small'], ['m', 'Medium'], ['l', 'Large'], ['xl', 'Extra large']] },
  { key: 'bodyFont', label: 'Text font', choices: [['default', 'Site default'], ['sans', 'Clean sans serif'], ['serif', 'Classic serif']] },
  { key: 'background', label: 'Background', choices: [['default', 'Default for this section'], ['white', 'White'], ['ivory', 'Soft ivory'], ['black', 'Black'], ['gold', 'Gold']] },
  { key: 'align', label: 'Alignment', choices: [['default', 'Default for this section'], ['left', 'Left'], ['center', 'Centred']] },
  { key: 'spacing', label: 'Space above and below', choices: [['default', 'Default'], ['compact', 'Compact'], ['roomy', 'Roomy']] },
];

/** Font, letter case, heading size, background, alignment and spacing for one homepage section. */
export function SectionStyleEditor({
  value,
  onChange,
  only,
}: {
  value: SectionStyle | undefined;
  onChange: (v: SectionStyle) => void;
  /** Limit the controls shown (the slider and banner heroes have their own fixed look). */
  only?: (keyof SectionStyle)[];
}) {
  const v = { ...DEFAULT_SECTION_STYLE, ...value };
  const changed = OPTIONS.some((o) => v[o.key] !== 'default');
  return (
    <details className="rounded-md border border-line p-3" open={changed}>
      <summary className="cursor-pointer py-1 font-semibold">Style: fonts, colours and layout{changed ? ' (customised)' : ''}</summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {OPTIONS.filter((o) => !only || only.includes(o.key)).map((o) => (
          <label key={o.key} className="block text-sm font-semibold">
            <span className="mb-1 block">{o.label}</span>
            <select
              value={v[o.key]}
              onChange={(e) => onChange({ ...v, [o.key]: e.target.value } as SectionStyle)}
              className={inputCls + ' font-normal'}
            >
              {o.choices.map(([val, label]) => (<option key={val} value={val}>{label}</option>))}
            </select>
          </label>
        ))}
      </div>
      {changed && (
        <button type="button" className="mt-3 min-h-11 rounded border px-3 text-sm" onClick={() => onChange(DEFAULT_SECTION_STYLE)}>
          Reset to the default look
        </button>
      )}
    </details>
  );
}
