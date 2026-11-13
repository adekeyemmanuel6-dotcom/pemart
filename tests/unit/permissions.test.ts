import { describe, expect, it } from 'vitest';
import { LEGACY_STAFF, PERMISSIONS, PRESETS, can, presetLabel, type Access } from '@/lib/admin/permissions';
import { navFor } from '@/lib/admin/nav';
import { DEFAULT_WEBSITE, MAX_CUSTOM_SECTIONS, SECTION_TEMPLATES, websiteSchema } from '@/lib/website/schema';
import { newSection } from '@/lib/website/templates';

const admin: Access = { role: 'admin', permissions: [...PERMISSIONS], preset: 'owner' };
const staff = (permissions = LEGACY_STAFF, preset: string | null = null): Access => ({ role: 'staff', permissions, preset });
const links = (a: Access) => navFor(a).flatMap((g) => g.items.map((i) => i.href));

describe('roles and menu', () => {
  it('owners see everything, including settings, team, payments and activity', () => {
    expect(links(admin)).toEqual(expect.arrayContaining(['/admin/settings', '/admin/team', '/admin/payments', '/admin/activity', '/admin/media']));
  });
  it('standard staff see what they saw before', () => {
    expect(links(staff())).toEqual(['/admin', '/admin/orders', '/admin/production', '/admin/proofs', '/admin/quotes', '/admin/customers', '/admin/reviews', '/admin/help']);
  });
  it('each preset sees only its areas, and never owner-only pages', () => {
    for (const p of PRESETS) {
      const l = links(staff(p.permissions, p.id));
      for (const owner of ['/admin/settings', '/admin/team', '/admin/payments', '/admin/activity']) expect(l, p.id).not.toContain(owner);
    }
    const editor = links(staff(PRESETS.find((p) => p.id === 'content_editor')!.permissions));
    expect(editor).toEqual(expect.arrayContaining(['/admin/website', '/admin/media', '/admin/discounts']));
    expect(editor).not.toContain('/admin/orders');
    expect(can(staff(['content']), 'admin')).toBe(false);
  });
  it('labels presets and custom mixes', () => {
    expect(presetLabel(staff(PRESETS[0]!.permissions, PRESETS[0]!.id))).toBe('Store Manager');
    expect(presetLabel(staff(['content'], 'store_manager'))).toBe('Staff (custom)');
    expect(presetLabel(admin)).toBe('Owner (admin)');
  });
});

describe('homepage sections from templates', () => {
  const withSections = (extra: unknown[]) => ({ ...DEFAULT_WEBSITE, sections: [...DEFAULT_WEBSITE.sections, ...extra] });
  it('every template creates a valid section, hidden until switched on', () => {
    for (const t of SECTION_TEMPLATES) {
      const s = newSection(t);
      expect(s.enabled).toBe(false);
      expect(websiteSchema.safeParse(withSections([s])).success, t).toBe(true);
    }
  });
  it('built-in sections cannot be removed, ids must be unique, and the count is limited', () => {
    const noHero = { ...DEFAULT_WEBSITE, sections: DEFAULT_WEBSITE.sections.filter((s) => s.id !== 'manifesto') };
    expect(websiteSchema.safeParse(noHero).success).toBe(false);
    const s = newSection('text');
    expect(websiteSchema.safeParse(withSections([s, s])).success).toBe(false);
    expect(websiteSchema.safeParse(withSections(Array.from({ length: MAX_CUSTOM_SECTIONS + 1 }, () => newSection('text')))).success).toBe(false);
    expect(websiteSchema.safeParse(withSections([{ ...newSection('text'), id: 'custom-<script>' }])).success).toBe(false);
    expect(websiteSchema.safeParse(withSections([{ ...newSection('text'), template: undefined }])).success).toBe(false);
  });
  it('rejects unsafe links in added sections', () => {
    expect(websiteSchema.safeParse(withSections([{ ...newSection('cta'), href: 'javascript:alert(1)' }])).success).toBe(false);
  });
});
