import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Tables } from '@/types/database'
import { PayIdBanner } from '@/components/PayIdBanner'

interface PersonResult {
  id: string
  label: string
  total: number
  itemLines: { description: string; share: number }[]
  discountLines: { description: string; amount: number }[]
}

function calculateResults(
  attendees: Tables<'attendees'>[],
  attendeeGroups: Tables<'attendee_groups'>[],
  items: Tables<'items'>[],
  assignments: Tables<'item_assignments'>[],
  discounts: Tables<'discounts'>[],
  discountAttendees: Tables<'discount_attendees'>[]
): PersonResult[] {
  const itemCount: Record<string, number> = {}
  for (const a of assignments) {
    itemCount[a.item_id] = (itemCount[a.item_id] ?? 0) + 1
  }

  const acc: Record<string, {
    total: number
    lines: { description: string; share: number }[]
    discountLines: { description: string; amount: number }[]
  }> = {}
  for (const a of attendees) acc[a.id] = { total: 0, lines: [], discountLines: [] }

  for (const a of assignments) {
    const item = items.find(i => i.id === a.item_id)
    if (!item || !acc[a.attendee_id]) continue
    const share = Math.round((item.price / (itemCount[a.item_id] ?? 1)) * 100) / 100
    acc[a.attendee_id].total = Math.round((acc[a.attendee_id].total + share) * 100) / 100
    acc[a.attendee_id].lines.push({ description: item.description, share })
  }

  // Apply discounts
  for (const discount of discounts) {
    const appliedIds = discountAttendees
      .filter(da => da.discount_id === discount.id)
      .map(da => da.attendee_id)
      .filter(id => acc[id])

    if (appliedIds.length === 0) continue

    if (discount.type === 'percentage') {
      const pct = discount.value / 100
      for (const id of appliedIds) {
        const discountAmount = Math.round(acc[id].total * pct * 100) / 100
        acc[id].total = Math.round((acc[id].total - discountAmount) * 100) / 100
        acc[id].discountLines.push({
          description: `Discount (${discount.value}% off)`,
          amount: discountAmount,
        })
      }
    } else {
      const selectedTotals = appliedIds.map(id => ({ id, rawTotal: acc[id].total }))
      const sumTotal = selectedTotals.reduce((s, t) => s + t.rawTotal, 0)
      if (sumTotal > 0) {
        for (const { id, rawTotal } of selectedTotals) {
          const proportion = rawTotal / sumTotal
          const discountAmount = Math.round(discount.value * proportion * 100) / 100
          acc[id].total = Math.round((acc[id].total - discountAmount) * 100) / 100
          acc[id].discountLines.push({
            description: `Discount ($${discount.value.toFixed(2)} off)`,
            amount: discountAmount,
          })
        }
      }
    }
  }

  const grouped = new Set<string>()
  const results: PersonResult[] = []

  for (const g of attendeeGroups) {
    const members = attendees.filter(a => a.group_id === g.id)
    for (const m of members) grouped.add(m.id)
    const total = members.reduce((s, m) => Math.round((s + (acc[m.id]?.total ?? 0)) * 100) / 100, 0)
    const lines = members.flatMap(m => acc[m.id]?.lines ?? [])
    const discountLines = members.flatMap(m => acc[m.id]?.discountLines ?? [])
    results.push({ id: g.id, label: g.label, total, itemLines: lines, discountLines })
  }

  for (const a of attendees) {
    if (grouped.has(a.id)) continue
    results.push({
      id: a.id,
      label: a.display_name,
      total: acc[a.id]?.total ?? 0,
      itemLines: acc[a.id]?.lines ?? [],
      discountLines: acc[a.id]?.discountLines ?? [],
    })
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
    { data: discounts },
  ] = await Promise.all([
    supabase.from('splits').select('*').eq('id', splitId).single(),
    supabase.from('attendees').select('*').eq('split_id', splitId),
    supabase.from('attendee_groups').select('*').eq('split_id', splitId),
    supabase.from('items').select('*').eq('split_id', splitId).order('sort_order'),
    supabase.from('discounts').select('*').eq('split_id', splitId).order('created_at'),
  ])

  if (!split) notFound()

  const itemIds = (items ?? []).map(i => i.id)
  const discountIds = (discounts ?? []).map(d => d.id)

  const [{ data: rawAssignments }, { data: discountAttendees }, { data: organiserProfile }] = await Promise.all([
    itemIds.length > 0
      ? supabase.from('item_assignments').select('*').in('item_id', itemIds)
      : Promise.resolve({ data: [] as Tables<'item_assignments'>[] }),
    discountIds.length > 0
      ? supabase.from('discount_attendees').select('*').in('discount_id', discountIds)
      : Promise.resolve({ data: [] as Tables<'discount_attendees'>[] }),
    supabase.from('users').select('display_name, payid, payid_label').eq('id', split.organiser_id).single(),
  ])

  const results = calculateResults(
    attendees ?? [],
    attendeeGroups ?? [],
    items ?? [],
    rawAssignments ?? [],
    discounts ?? [],
    discountAttendees ?? []
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
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gwfc-blue">{split.title}</h1>
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

        {/* PayID banner */}
        {organiserProfile?.payid && (
          <PayIdBanner
            organiseName={organiserProfile.display_name}
            payid={organiserProfile.payid}
            payidLabel={organiserProfile.payid_label}
          />
        )}

        {/* Per-person breakdown */}
        {results.map(person => (
          <div key={person.id} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between px-4 py-4">
              <div>
                <p className="font-semibold text-gwfc-blue">{person.label}</p>
                <p className="text-xs text-slate-400">
                  {person.itemLines.length} item{person.itemLines.length !== 1 ? 's' : ''}
                  {person.discountLines.length > 0 && (
                    <span className="ml-1 text-emerald-600">
                      · {person.discountLines.length} discount{person.discountLines.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </p>
              </div>
              <p className="text-xl font-bold text-gwfc-blue">${person.total.toFixed(2)}</p>
            </div>
            {(person.itemLines.length > 0 || person.discountLines.length > 0) && (
              <div className="border-t border-slate-100">
                {person.itemLines.map((line, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="text-slate-600">{line.description}</span>
                    <span className="font-medium text-gwfc-blue">${line.share.toFixed(2)}</span>
                  </div>
                ))}
                {person.discountLines.map((line, i) => (
                  <div key={i} className="flex items-center justify-between bg-emerald-50 px-4 py-2.5 text-sm">
                    <span className="text-emerald-700">{line.description}</span>
                    <span className="font-medium text-emerald-700">−${line.amount.toFixed(2)}</span>
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
