import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SplitDetail } from './SplitDetail'

export default async function SplitDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: split } = await supabase
    .from('splits')
    .select('*')
    .eq('id', id)
    .single()

  if (!split || split.organiser_id !== user.id) notFound()

  if (split.status === 'finalised') redirect(`/splits/${id}/results`)

  const [
    { data: items },
    { data: attendees },
    { data: attendeeGroups },
  ] = await Promise.all([
    supabase.from('items').select('*').eq('split_id', id).order('sort_order'),
    supabase.from('attendees').select('*').eq('split_id', id),
    supabase.from('attendee_groups').select('*').eq('split_id', id),
  ])

  const itemIds = (items ?? []).map(i => i.id)
  const { data: rawAssignments } = itemIds.length > 0
    ? await supabase.from('item_assignments').select('*').in('item_id', itemIds)
    : { data: [] as { item_id: string; attendee_id: string }[] }

  const assignmentMap: Record<string, string[]> = {}
  for (const a of rawAssignments ?? []) {
    if (!assignmentMap[a.item_id]) assignmentMap[a.item_id] = []
    assignmentMap[a.item_id].push(a.attendee_id)
  }

  let signedReceiptUrl: string | null = null
  if (split.receipt_url) {
    const { data } = await supabase.storage
      .from('receipts')
      .createSignedUrl(split.receipt_url, 3600)
    signedReceiptUrl = data?.signedUrl ?? null
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SplitDetail
        split={split}
        attendees={attendees ?? []}
        attendeeGroups={attendeeGroups ?? []}
        items={items ?? []}
        initialAssignments={assignmentMap}
        signedReceiptUrl={signedReceiptUrl}
      />
    </div>
  )
}
