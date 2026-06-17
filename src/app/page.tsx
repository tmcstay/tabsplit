import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Tables, SplitStatus } from '@/types/database'

type GroupWithCount = Tables<'groups'> & { group_members: [{ count: number }] | [] }
type SplitWithCount = Tables<'splits'> & { attendees: [{ count: number }] | [] }

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso))
}

const STATUS_STYLES: Record<SplitStatus, { label: string; cls: string }> = {
  pending: { label: 'Pending', cls: 'bg-amber-50 text-amber-700' },
  draft:   { label: 'Draft',   cls: 'bg-zinc-100 text-zinc-500' },
  finalised: { label: 'Finalised', cls: 'bg-green-50 text-green-700' },
}

function StatusBadge({ status }: { status: SplitStatus }) {
  const { label, cls } = STATUS_STYLES[status]
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  )
}

function GroupCard({ group }: { group: GroupWithCount }) {
  const count = group.group_members[0]?.count ?? 0
  return (
    <Link
      href={`/groups/${group.id}`}
      className="flex w-36 shrink-0 flex-col rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200 active:bg-zinc-50"
    >
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"
          stroke="#a1a1aa" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="7" r="3.5" />
          <path d="M2 20c0-3.3 3.1-6 7-6s7 2.7 7 6" />
          <circle cx="17" cy="9" r="2.5" />
          <path d="M22 20c0-2.2-1.8-4-4-4" />
        </svg>
      </div>
      <p className="truncate text-sm font-semibold text-zinc-900">{group.name}</p>
      <p className="mt-0.5 text-xs text-zinc-400">
        {count} {count === 1 ? 'member' : 'members'}
      </p>
    </Link>
  )
}

function SplitCard({ split }: { split: SplitWithCount }) {
  const count = split.attendees[0]?.count ?? 0
  return (
    <Link
      href={`/splits/${split.id}`}
      className="block rounded-2xl bg-white px-4 py-4 shadow-sm ring-1 ring-zinc-200 active:bg-zinc-50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-zinc-900">{split.title}</p>
          <p className="mt-0.5 text-xs text-zinc-400">
            {formatDate(split.created_at)}
            {count > 0 && ` · ${count} ${count === 1 ? 'person' : 'people'}`}
          </p>
        </div>
        <StatusBadge status={split.status} />
      </div>
    </Link>
  )
}

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: groups }, { data: splits }] = await Promise.all([
    supabase
      .from('groups')
      .select('*, group_members(count)')
      .eq('organiser_id', user.id)
      .eq('saved', true)
      .order('name'),
    supabase
      .from('splits')
      .select('*, attendees(count)')
      .eq('organiser_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const hasSavedGroups = (groups?.length ?? 0) > 0
  const hasSplits = (splits?.length ?? 0) > 0

  return (
    <div className="flex min-h-screen flex-col pb-36">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white px-4 py-4">
        <h1 className="text-xl font-bold tracking-tight text-zinc-900">TabSplit</h1>
      </header>

      <main className="flex-1 space-y-8 py-6">
        {hasSavedGroups && (
          <section>
            <h2 className="mb-3 px-4 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Saved Groups
            </h2>
            <div className="flex gap-3 overflow-x-auto px-4 pb-1">
              {(groups as GroupWithCount[]).map(group => (
                <GroupCard key={group.id} group={group} />
              ))}
            </div>
          </section>
        )}

        <section className="px-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Recent Splits
          </h2>
          {hasSplits ? (
            <div className="space-y-3">
              {(splits as SplitWithCount[]).map(split => (
                <SplitCard key={split.id} split={split} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true"
                  stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5" y="2" width="14" height="20" rx="2" />
                  <path d="M9 7h6M9 11h6M9 15h4" />
                </svg>
              </div>
              <p className="text-base font-semibold text-zinc-900">No splits yet</p>
              <p className="mt-1.5 max-w-xs text-sm text-zinc-400">
                Start by adding a group or a new split.
              </p>
            </div>
          )}
        </section>
      </main>

      <div className="fixed bottom-16 inset-x-0 px-4 pb-3">
        <div className="flex gap-3">
          <Link
            href="/groups/new"
            className="flex flex-1 items-center justify-center rounded-2xl bg-white py-3.5 text-sm font-semibold text-zinc-900 shadow-sm ring-1 ring-zinc-200 active:bg-zinc-50"
          >
            New Group
          </Link>
          <Link
            href="/splits/new"
            className="flex flex-1 items-center justify-center rounded-2xl bg-zinc-900 py-3.5 text-sm font-semibold text-white shadow-lg active:bg-zinc-700"
          >
            New Split
          </Link>
        </div>
      </div>
    </div>
  )
}
