import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NewSplitForm } from './NewSplitForm'

export default async function NewSplitPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string; members?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { group: groupId, members: membersParam } = await searchParams

  let groupName: string | null = null
  let initialAttendees: { id: string; display_name: string; phone: string | null; email: string | null }[] = []

  if (groupId) {
    const memberIds = membersParam?.split(',').filter(Boolean) ?? []

    const [{ data: group }, { data: members }] = await Promise.all([
      supabase.from('groups').select('name').eq('id', groupId).single(),
      memberIds.length > 0
        ? supabase
            .from('group_members')
            .select('id, display_name, phone, email')
            .eq('group_id', groupId)
            .in('id', memberIds)
        : supabase
            .from('group_members')
            .select('id, display_name, phone, email')
            .eq('group_id', groupId),
    ])

    groupName = group?.name ?? null
    initialAttendees = (members ?? []).map(m => ({
      id: m.id,
      display_name: m.display_name,
      phone: m.phone ?? null,
      email: m.email ?? null,
    }))
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-4">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">New Split</h1>
      </header>
      <main className="flex-1 px-4 py-6 pb-24">
        <NewSplitForm
          userId={user.id}
          groupId={groupId ?? null}
          groupName={groupName}
          initialAttendees={initialAttendees}
        />
      </main>
    </div>
  )
}
