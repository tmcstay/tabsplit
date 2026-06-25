import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Tables } from '@/types/database'
import { GroupsPageClient } from './GroupsPageClient'

type GroupWithCount = Tables<'groups'> & { group_members: [{ count: number }] | [] }

export default async function GroupsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: groups }, { data: favourites }] = await Promise.all([
    supabase
      .from('groups')
      .select('*, group_members(count)')
      .eq('organiser_id', user.id)
      .eq('saved', true)
      .order('name'),
    supabase
      .from('favourite_contacts')
      .select('*')
      .eq('user_id', user.id)
      .order('display_name'),
  ])

  return (
    <div className="flex min-h-screen flex-col pb-32">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 pb-4 safe-top">
        <h1 className="text-xl font-bold tracking-tight text-gwfc-blue">Groups</h1>
      </header>
      <GroupsPageClient
        groups={(groups ?? []) as unknown as GroupWithCount[]}
        favourites={favourites ?? []}
      />
    </div>
  )
}
