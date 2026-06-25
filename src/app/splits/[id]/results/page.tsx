import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Tables } from '@/types/database'
import { ShareButton } from './ShareButton'
import { EditButton } from './EditButton'
import { PersonCard } from './PersonCard'
import type { PersonResult } from './PersonCard'
import { ShareWithEveryone } from './ShareWithEveryone'
import type { ModalAttendee } from './ShareWithEveryone'
import { ReceiptViewer } from './ReceiptViewer'
import { PayIdBanner } from '@/components/PayIdBanner'

type AttendeeAcc = {
  total: number
  lines: { description: string; share: number }[]
  discountLines: { description: string; amount: number }[]
}

function buildAcc(
  attendees: Tables<'attendees'>[],
  items: Tables<'items'>[],
  assignments: Tables<'item_assignments'>[],
  discounts: Tables<'discounts'>[],
  discountAttendees: Tables<'discount_attendees'>[]
): Record<string, AttendeeAcc> {
  const itemCount: Record<string, number> = {}
  for (const a of assignments) {
    itemCount[a.item_id] = (itemCount[a.item_id] ?? 0) + 1
  }

  const acc: Record<string, AttendeeAcc> = {}
  for (const a of attendees) acc[a.id] = { total: 0, lines: [], discountLines: [] }

  for (const a of assignments) {
    const item = items.find(i => i.id === a.item_id)
    if (!item || !acc[a.attendee_id]) continue
    const share = Math.round((item.price / (itemCount[a.item_id] ?? 1)) * 100) / 100
    acc[a.attendee_id].total = Math.round((acc[a.attendee_id].total + share) * 100) / 100
    acc[a.attendee_id].lines.push({ description: item.description, share })
  }

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

  return acc
}

function calculateResults(
  acc: Record<string, AttendeeAcc>,
  attendees: Tables<'attendees'>[],
  attendeeGroups: Tables<'attendee_groups'>[]
): PersonResult[] {
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
    { data: discounts },
    { data: organiserProfile },
  ] = await Promise.all([
    supabase.from('attendees').select('*').eq('split_id', id),
    supabase.from('attendee_groups').select('*').eq('split_id', id),
    supabase.from('items').select('*').eq('split_id', id).order('sort_order'),
    supabase.from('share_links').select('token').eq('split_id', id).limit(1),
    supabase.from('discounts').select('*').eq('split_id', id).order('created_at'),
    supabase.from('users').select('display_name, payid, payid_label').eq('id', user.id).single(),
  ])

  const itemIds = (items ?? []).map(i => i.id)
  const discountIds = (discounts ?? []).map(d => d.id)

  const [{ data: rawAssignments }, { data: discountAttendees }] = await Promise.all([
    itemIds.length > 0
      ? supabase.from('item_assignments').select('*').in('item_id', itemIds)
      : Promise.resolve({ data: [] as Tables<'item_assignments'>[] }),
    discountIds.length > 0
      ? supabase.from('discount_attendees').select('*').in('discount_id', discountIds)
      : Promise.resolve({ data: [] as Tables<'discount_attendees'>[] }),
  ])

  const acc = buildAcc(
    attendees ?? [],
    items ?? [],
    rawAssignments ?? [],
    discounts ?? [],
    discountAttendees ?? []
  )

  const results = calculateResults(acc, attendees ?? [], attendeeGroups ?? [])

  const groupedAttendeeIds = new Set(
    (attendeeGroups ?? []).flatMap(g =>
      (attendees ?? []).filter(a => a.group_id === g.id).map(a => a.id)
    )
  )
  const modalAttendees: ModalAttendee[] = [
    ...(attendeeGroups ?? []).map(g => {
      const members = (attendees ?? []).filter(a => a.group_id === g.id)
      const total = members.reduce(
        (s, m) => Math.round((s + (acc[m.id]?.total ?? 0)) * 100) / 100,
        0
      )
      return {
        id: g.id,
        display_name: g.label,
        phone: g.phone ?? null,
        email: g.email ?? null,
        total,
      }
    }),
    ...(attendees ?? [])
      .filter(a => a.user_id !== user.id && !groupedAttendeeIds.has(a.id))
      .map(a => ({
        id: a.id,
        display_name: a.display_name,
        phone: a.phone ?? null,
        email: a.email ?? null,
        total: acc[a.id]?.total ?? 0,
      })),
  ]

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
    <div className="flex min-h-screen flex-col pb-32">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 pb-4 safe-top">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold tracking-tight text-gwfc-blue">{split.title}</h1>
            <p className="text-xs text-slate-400">{dateStr}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <EditButton splitId={id} />
            {shareToken && <ShareButton token={shareToken} />}
          </div>
        </div>
      </header>

      <main className="flex-1 space-y-4 px-4 py-6">
        {/* Grand total — gradient card */}
        {split.total != null && (
          <div
            className="rounded-2xl px-5 py-4 text-white shadow-sm"
            style={{ background: 'linear-gradient(135deg, #425197, #1079bf)' }}
          >
            <p className="text-xs font-semibold uppercase tracking-wide opacity-75">Total</p>
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

        {/* Share with everyone */}
        {shareToken && (
          <ShareWithEveryone
            splitTitle={split.title}
            shareToken={shareToken}
            attendees={modalAttendees}
            organiserPayid={organiserProfile?.payid ?? null}
            organiserPayidLabel={organiserProfile?.payid_label ?? null}
          />
        )}

        {/* Per-person results */}
        {results.map(person => (
          <PersonCard key={person.id} person={person} />
        ))}

        {/* Receipt at the bottom — collapsed by default */}
        {signedReceiptUrl && (
          <ReceiptViewer url={signedReceiptUrl} />
        )}
      </main>
    </div>
  )
}
