import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Tables } from '@/types/database'
import { SplitList } from './SplitList'

type GroupWithCount = Tables<'groups'> & { group_members: [{ count: number }] | [] }
type SplitWithCount = Tables<'splits'> & { attendees: [{ count: number }] | [] }

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
              {(groups as unknown as GroupWithCount[]).map(group => (
                <GroupCard key={group.id} group={group} />
              ))}
            </div>
          </section>
        )}

        <section className="px-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Recent Splits
          </h2>
          <SplitList initialSplits={(splits ?? []) as unknown as SplitWithCount[]} />
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
