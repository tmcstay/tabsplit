import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Tables } from '@/types/database'
import { ShareButton } from './ShareButton'

interface PersonResult {
  id: string
  label: string
  total: number
  itemLines: { description: string; share: number }[]
}

function calculateResults(
  attendees: Tables<'attendees'>[],
  attendeeGroups: Tables<'attendee_groups'>[],
  items: Tables<'items'>[],
  assignments: Tables<'item_assignments'>[]
): PersonResult[] {
  // Count assignees per item for splitting
  const itemCount: Record<string, number> = {}
  for (const a of assignments) {
    itemCount[a.item_id] = (itemCount[a.item_id] ?? 0) + 1
  }

  // Per-attendee accumulation
  const acc: Record<string, { total: number; lines: { description: string; share: number }[] }> = {}
  for (const a of attendees) acc[a.id] = { total: 0, lines: [] }

  for (const a of assignments) {
    const item = items.find(i => i.id === a.item_id)
    if (!item || !acc[a.attendee_id]) continue
    const share = Math.round((item.price / (itemCount[a.item_id] ?? 1)) * 100) / 100
    acc[a.attendee_id].total = Math.round((acc[a.attendee_id].total + share) * 100) / 100
    acc[a.attendee_id].lines.push({ description: item.description, share })
  }

  const grouped = new Set<string>()
  const results: PersonResult[] = []

  for (const g of attendeeGroups) {
    const members = attendees.filter(a => a.group_id === g.id)
    for (const m of members) grouped.add(m.id)
    const total = members.reduce((s, m) => Math.round((s + (acc[m.id]?.total ?? 0)) * 100) / 100, 0)
    const lines = members.flatMap(m => acc[m.id]?.lines ?? [])
    results.push({ id: g.id, label: g.label, total, itemLines: lines })
  }

  for (const a of attendees) {
    if (grouped.has(a.id)) continue
    results.push({
      id: a.id,
      label: a.display_name,
      total: acc[a.id]?.total ?? 0,
      itemLines: acc[a.id]?.lines ?? [],
    })
  }

  return results.sort((a, b) => b.total - a.total)
}

export default async function SplitResultsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: split } = await supabase.from('splits').select('*').eq('id', id).single()
  if (!split || split.organiser_id !== user.id) notFound()
  if (split.status !== 'finalised') redirect(`/splits/${id}`)

  const [
    { data: attendees },
    { data: attendeeGroups },
    { data: items },
    { data: shareLinks },
  ] = await Promise.all([
    supabase.from('attendees').select('*').eq('split_id', id),
    supabase.from('attendee_groups').select('*').eq('split_id', id),
    supabase.from('items').select('*').eq('split_id', id).order('sort_order'),
    supabase.from('share_links').select('token').eq('split_id', id).limit(1),
  ])

  const itemIds = (items ?? []).map(i => i.id)
  const { data: rawAssignments } = itemIds.length > 0
    ? await supabase.from('item_assignments').select('*').in('item_id', itemIds)
    : { data: [] as Tables<'item_assignments'>[] }

  const results = calculateResults(
    attendees ?? [],
    attendeeGroups ?? [],
    items ?? [],
    rawAssignments ?? []
  )

  let signedReceiptUrl: string | null = null
  if (split.receipt_url) {
    const { data } = await supabase.storage.from('receipts').createSignedUrl(split.receipt_url, 3600)
    signedReceiptUrl = data?.signedUrl ?? null
  }

  const shareToken = shareLinks?.[0]?.token ?? null
  const dateStr = new Date(split.created_at).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="flex min-h-screen flex-col pb-24">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold tracking-tight text-slate-900">{split.title}</h1>
            <p className="text-xs text-slate-400">{dateStr}</p>
          </div>
          {shareToken && <ShareButton token={shareToken} />}
        </div>
      </header>

      <main className="flex-1 space-y-4 px-4 py-6">
        {/* Receipt thumbnail */}
        {signedReceiptUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={signedReceiptUrl}
            alt="Receipt"
            className="max-h-32 w-full rounded-xl object-cover shadow-sm ring-1 ring-slate-200"
          />
        )}

        {/* Grand total */}
        {split.total != null && (
          <div className="rounded-xl bg-slate-900 px-5 py-4 text-white">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Total</p>
            <p className="mt-1 text-3xl font-bold">${split.total.toFixed(2)}</p>
          </div>
        )}

        {/* Per-person results */}
        {results.map(person => (
          <PersonCard key={person.id} person={person} />
        ))}
      </main>
    </div>
  )
}

function PersonCard({ person }: { person: PersonResult }) {
  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between px-4 py-4">
        <div>
          <p className="font-semibold text-slate-900">{person.label}</p>
          <p className="text-xs text-slate-400">
            {person.itemLines.length} item{person.itemLines.length !== 1 ? 's' : ''}
          </p>
        </div>
        <p className="text-xl font-bold text-slate-900">${person.total.toFixed(2)}</p>
      </div>
      {person.itemLines.length > 0 && (
        <div className="border-t border-slate-100">
          {person.itemLines.map((line, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span className="text-slate-600">{line.description}</span>
              <span className="font-medium text-slate-900">${line.share.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
