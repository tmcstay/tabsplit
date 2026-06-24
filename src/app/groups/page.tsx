import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Tables } from '@/types/database'

type GroupWithCount = Tables<'groups'> & { group_members: [{ count: number }] | [] }

const GRADIENTS = [
  'linear-gradient(135deg, #14b8a6, #3b82f6)',
  'linear-gradient(135deg, #f97316, #ef4444)',
  'linear-gradient(135deg, #8b5cf6, #6366f1)',
  'linear-gradient(135deg, #1caebb, #1079bf)',
]

function getGradient(id: string): string {
  const hash = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return GRADIENTS[hash % GRADIENTS.length]
}

function GroupsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"
      stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="7" r="3.5" />
      <path d="M2 20c0-3.3 3.1-6 7-6s7 2.7 7 6" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M22 20c0-2.2-1.8-4-4-4" />
    </svg>
  )
}

function GroupCard({ group }: { group: GroupWithCount }) {
  const count = group.group_members[0]?.count ?? 0
  return (
    <Link
      href={`/groups/${group.id}`}
      className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3.5 shadow-sm ring-1 ring-slate-200 active:bg-slate-50"
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ background: getGradient(group.id) }}
      >
        <GroupsIcon />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-gwfc-blue">{group.name}</p>
        <p className="mt-0.5 text-xs text-slate-400">
          {count} {count === 1 ? 'member' : 'members'}
        </p>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"
        stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </Link>
  )
}

export default async function GroupsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: groups } = await supabase
    .from('groups')
    .select('*, group_members(count)')
    .eq('organiser_id', user.id)
    .eq('saved', true)
    .order('name')

  return (
    <div className="flex min-h-screen flex-col pb-32">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 pb-4 safe-top">
        <h1 className="text-xl font-bold tracking-tight text-gwfc-blue">Groups</h1>
      </header>

      <main className="flex-1 px-4 py-5">
        {(!groups || groups.length === 0) ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true"
                stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="7" r="3.5" />
                <path d="M2 20c0-3.3 3.1-6 7-6s7 2.7 7 6" />
                <circle cx="17" cy="9" r="2.5" />
                <path d="M22 20c0-2.2-1.8-4-4-4" />
              </svg>
            </div>
            <p className="text-base font-semibold text-gwfc-blue">No saved groups yet</p>
            <p className="mt-1.5 max-w-xs text-sm text-slate-400">
              Create a group to quickly add the same people to future splits.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {(groups as unknown as GroupWithCount[]).map(group => (
              <GroupCard key={group.id} group={group} />
            ))}
          </div>
        )}

        <Link
          href="/groups/new"
          className="mt-6 flex w-full items-center justify-center rounded-2xl bg-gwfc-blue py-3.5 text-sm font-semibold text-white shadow-sm active:opacity-90"
        >
          New Group
        </Link>
      </main>
    </div>
  )
}
