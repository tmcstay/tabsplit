import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { GroupDetail } from './GroupDetail'

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: group }, { data: members }] = await Promise.all([
    supabase
      .from('groups')
      .select('*')
      .eq('id', id)
      .eq('organiser_id', user.id)
      .single(),
    supabase
      .from('group_members')
      .select('*')
      .eq('group_id', id)
      .order('display_name'),
  ])

  if (!group) notFound()

  return (
    <div className="flex min-h-screen flex-col pb-32">
      <GroupDetail group={group} members={members ?? []} />
    </div>
  )
}
