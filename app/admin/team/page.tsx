import type { Metadata } from 'next';
import { ActionForm } from '@/components/admin/action-form';
import { NeedsMigration } from '@/components/admin/needs-migration';
import { Card, DataTable, PageTitle, fmtDate, inputCls, labelCls } from '@/components/admin/ui';
import { setRoleAction } from '@/lib/admin/actions-control';
import { adm, isMissingFunction, requireAdmin } from '@/lib/admin/db';
import { dbMode } from '@/lib/db';
import { createAdminClient } from '@/lib/supabase/admin';

export const metadata: Metadata = { title: 'Team & permissions' };

type Member = { id: string; email: string | null; name: string | null; role: 'staff' | 'admin'; last_sign_in_at: string | null };

/** Whether each person has a verified authenticator. Read with the service role on the server only. */
async function twoFactor(ids: string[]): Promise<Record<string, boolean | null>> {
  if (dbMode() !== 'supabase') return Object.fromEntries(ids.map((id) => [id, null]));
  const admin = createAdminClient();
  const entries = await Promise.all(ids.map(async (id) => {
    try {
      const { data } = await admin.auth.admin.mfa.listFactors({ userId: id });
      return [id, !!data?.factors?.some((f) => f.status === 'verified')] as const;
    } catch { return [id, null] as const; }
  }));
  return Object.fromEntries(entries);
}

const ROLE_HELP = [
  ['Admin', 'Everything: products, prices, website, discounts, reports, settings, delivery and this page.'],
  ['Staff', 'Day-to-day operations: orders, production board, proofs, bulk quotes, reviews and customers. Cannot change prices, settings or the website.'],
];

export default async function TeamPage() {
  const me = await requireAdmin('/admin/team');
  let team: Member[] | null = null;
  try { team = await adm<Member[]>('admin_team_list', me); } catch (e) { if (!isMissingFunction(e)) throw e; }
  const mfa = team ? await twoFactor(team.map((m) => m.id)) : {};

  return (
    <>
      <PageTitle title="Team & permissions" sub="Who can open this admin, and what they can do." />
      {!team ? <NeedsMigration migration="0017_admin_control.sql" what="Team management" /> : (
        <div className="space-y-5">
          <DataTable caption="Team members" head={['Person', 'Access', 'Two-factor', 'Last sign-in', '']}>
            {team.map((m) => (
              <tr key={m.id}>
                <td className="px-3 py-2.5 font-semibold">{m.name ?? m.email}<div className="text-xs font-normal text-muted">{m.email}{m.id === me.id ? ' · you' : ''}</div></td>
                <td className="px-3 py-2.5">{m.role === 'admin' ? 'Admin' : 'Staff'}</td>
                <td className="px-3 py-2.5">{mfa[m.id] === true ? 'Set up' : mfa[m.id] === false ? <span className="text-ember">Not yet (asked at next sign-in)</span> : '—'}</td>
                <td className="px-3 py-2.5">{fmtDate(m.last_sign_in_at, true)}</td>
                <td className="px-3 py-2.5">
                  {m.id !== me.id && m.email && (
                    <ActionForm action={setRoleAction} submitLabel="Remove access" pendingLabel="Removing…" variant="secondary" className="[&_button]:mt-0" confirm={`Remove admin access for ${m.email}? They keep their customer account.`}>
                      <input type="hidden" name="email" value={m.email} />
                      <input type="hidden" name="role" value="customer" />
                    </ActionForm>
                  )}
                </td>
              </tr>
            ))}
          </DataTable>

          <Card title="Give someone access">
            <p className="mb-3 text-sm text-muted">They must already have an account on the website (Create an account, with this email). Changing an existing person&apos;s access works the same way.</p>
            <ActionForm action={setRoleAction} submitLabel="Save access" resetOnSuccess className="grid gap-3 sm:grid-cols-[1fr_200px] sm:items-end">
              <div><label htmlFor="t-email" className={labelCls}>Email</label><input id="t-email" name="email" type="email" required autoComplete="off" className={inputCls} /></div>
              <div><label htmlFor="t-role" className={labelCls}>Access</label>
                <select id="t-role" name="role" defaultValue="staff" className={inputCls}>
                  <option value="staff">Staff</option><option value="admin">Admin</option><option value="customer">No admin access</option>
                </select>
              </div>
            </ActionForm>
          </Card>

          <Card title="What each role can do">
            <dl className="space-y-2 text-sm">{ROLE_HELP.map(([r, d]) => (<div key={r}><dt className="font-semibold">{r}</dt><dd className="text-muted">{d}</dd></div>))}</dl>
            <p className="mt-3 text-sm text-muted">Everyone with access must use two-factor sign-in. You cannot change your own access, and the store always keeps at least one admin. Every change is recorded in the Activity log.</p>
          </Card>
        </div>
      )}
    </>
  );
}
