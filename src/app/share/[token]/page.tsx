import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Tables } from '@/types/database'

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
  const itemCount: Record<string, number> = {}
  for (const a of assignments) {
    itemCount[a.item_id] = (itemCount[a.item_id] ?? 0) + 1
  }

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
    results.push({ id: g.id, label: g.label, total, itemLines: members.flatMap(m => acc[m.id]?.lines ?? []) })
  }

  for (const a of attendees) {
    if (grouped.has(a.id)) continue
    results.push({ id: a.id, label: a.display_name, total: acc[a.id]?.total ?? 0, itemLines: acc[a.id]?.lines ?? [] })
  }

  return results.sort((a, b) => b.total - a.total)
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  // Use anon client — RLS allows public read for finalised splits via share token
  const supabase = await createClient()

  const { data: shareLink } = await supabase
    .from('share_links')
    .select('split_id')
    .eq('token', token)
    .single()

  if (!shareLink) notFound()

  const splitId = shareLink.split_id

  const [
    { data: split },
    { data: attendees },
    { data: attendeeGroups },
    { data: items },
  ] = await Promise.all([
    supabase.from('splits').select('*').eq('id', splitId).single(),
    supabase.from('attendees').select('*').eq('split_id', splitId),
    supabase.from('attendee_groups').select('*').eq('split_id', splitId),
    supabase.from('items').select('*').eq('split_id', splitId).order('sort_order'),
  ])

  if (!split) notFound()

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

  const dateStr = new Date(split.created_at).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white px-4 py-5">
        <div className="mx-auto max-w-lg">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">TabSplit</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{split.title}</h1>
          <p className="text-sm text-slate-400">{dateStr}</p>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 px-4 py-6">
        {/* Grand total */}
        {split.total != null && (
          <div className="rounded-xl bg-slate-900 px-5 py-4 text-white">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Total</p>
            <p className="mt-1 text-3xl font-bold">${split.total.toFixed(2)}</p>
          </div>
        )}

        {/* Per-person breakdown */}
        {results.map(person => (
          <div key={person.id} className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
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
        ))}

        <p className="text-center text-xs text-slate-400">
          Split calculated by TabSplit · Read only
        </p>
      </main>
    </div>
  )
}
