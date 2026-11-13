'use client';
import { useEffect, useId, useRef } from 'react';
import { AdminUploader } from './admin-uploader';
import { MediaPickerButton } from './media-library';
import { inputCls } from './ui';

export function Field({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  multiline?: boolean;
}) {
  const id = useId();
  const displayLabel =
    (
      {
        title: 'Heading',
        body: 'Supporting text',
        secondaryText: 'Second button label',
        secondaryHref: 'Second button destination',
        intro: 'Introduction',
        kicker: 'Small heading',
        name: 'Display name',
        blurb: 'Description',
      } as Record<string, string>
    )[label] || label;
  return (
    <div className="block text-sm font-semibold">
      <label htmlFor={id} className="mb-1 block">
        {displayLabel}
      </label>
      {multiline ? (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={label === 'Page content' ? 14 : 4}
          className={inputCls + ' py-2 font-normal'}
        />
      ) : (
        <input id={id} value={value} onChange={(e) => onChange(e.target.value)} className={inputCls + ' font-normal'} />
      )}
    </div>
  );
}
export function ImageField({ value, onChange }: { value: string; onChange: (s: string) => void }) {
  const latestChange = useRef(onChange);
  useEffect(() => {
    latestChange.current = onChange;
  }, [onChange]);
  return (
    <div className="space-y-2">
      <AdminUploader
        bucket="catalogue"
        label="Upload image"
        accept=".jpg,.jpeg,.png,.webp"
        initial={value}
        onDone={(v) => latestChange.current(v.url)}
      />
      <MediaPickerButton onPick={(url) => latestChange.current(url)} />
      <Field label="Image URL (or upload / choose above)" value={value} onChange={onChange} />
      {value && (
        <button type="button" onClick={() => onChange('')} className="min-h-11 text-sm underline">
          Remove image
        </button>
      )}
    </div>
  );
}
export function Move({ index, length, onMove }: { index: number; length: number; onMove: (to: number) => void }) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        disabled={index === 0}
        onClick={() => onMove(index - 1)}
        className="min-h-11 rounded border px-3 text-sm disabled:opacity-30"
        aria-label="Move up"
      >
        ↑ Up
      </button>
      <button
        type="button"
        disabled={index === length - 1}
        onClick={() => onMove(index + 1)}
        className="min-h-11 rounded border px-3 text-sm disabled:opacity-30"
        aria-label="Move down"
      >
        ↓ Down
      </button>
    </div>
  );
}
export function reorder<T>(items: T[], from: number, to: number) {
  const result = [...items];
  const [item] = result.splice(from, 1);
  result.splice(to, 0, item!);
  return result;
}

