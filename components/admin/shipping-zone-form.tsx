import { ActionForm } from './action-form';
import { Card, inputCls, labelCls } from './ui';
import { saveZoneAction } from '@/lib/admin/actions-admin';
import type { DeliveryZone } from '@/lib/catalogue/types';
import { NIGERIAN_STATES } from '@/lib/shipping';
export function ShippingZoneForm({ zone }: { zone?: DeliveryZone }) {
  const z = zone;
  const id = z?.id ?? 'new';
  const field = (name: string, label: string, value: string | number | null | undefined, type = 'text') => (
    <div key={name}>
      <label className={labelCls} htmlFor={`${id}-${name}`}>
        {label}
      </label>
      <input
        id={`${id}-${name}`}
        name={name}
        type={type}
        defaultValue={value ?? ''}
        min={type === 'number' ? 0 : undefined}
        className={inputCls}
      />
    </div>
  );
  const check = (name: string, label: string, value: boolean) => (
    <label key={name} className="flex min-h-11 items-center gap-2 text-sm">
      <input name={name} type="checkbox" defaultChecked={value} className="size-5" />
      {label}
    </label>
  );
  return (
    <Card title={z?.name ?? 'Add delivery service'}>
      <ActionForm action={saveZoneAction} submitLabel={z ? 'Save delivery service' : 'Create delivery service'}>
        <input type="hidden" name="id" value={z?.id ?? ''} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {field('name', 'Zone / service name', z?.name)}
          {field('states', 'States (comma-separated)', z?.states.join(', '))}
          {field('cities', 'Cities (comma-separated; blank = whole state)', z?.cities?.join(', '))}
          {field('provider', 'Logistics provider', z?.provider)}
          {field('service', 'Service type', z?.service)}
          {field('fee', 'Verified delivery fee (₦)', z ? z.fee_kobo / 100 : '')}
          {field('min_days', 'Minimum delivery days (verified)', z?.min_days, 'number')}
          {field('max_days', 'Maximum delivery days (verified)', z?.max_days, 'number')}
          {field('sort_order', 'Display priority', z?.sort_order ?? 0, 'number')}
          {field(
            'weight_allowance_grams',
            'Included packed weight (grams, optional)',
            z?.weight_allowance_grams,
            'number',
          )}
          {field(
            'additional_kg',
            'Fee per additional started kg (₦, optional)',
            z?.additional_kg_kobo == null ? '' : z.additional_kg_kobo / 100,
          )}
        </div>
        <p className="mt-3 text-xs text-muted">
          Valid states: {NIGERIAN_STATES.join(', ')}. Weight-limited services require verified packed weights; bundles
          and custom orders need a team-confirmed service.
        </p>
        <div className="mt-3 flex flex-wrap gap-x-6">
          {check('is_active', 'Active', z?.is_active ?? true)}
          {check('rate_verified', 'I have verified this carrier rate', z?.rate_verified ?? false)}
          {check('free_shipping_eligible', 'Eligible for national free delivery', z?.free_shipping_eligible ?? true)}
        </div>
      </ActionForm>
    </Card>
  );
}
