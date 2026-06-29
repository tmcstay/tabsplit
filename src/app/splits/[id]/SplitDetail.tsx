'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Tables } from '@/types/database'
import { saveItems, assignItem, mergeAttendees, unmergeGroup, finaliseSplit, equalSplit, addLineItem, applyDiscount, removeDiscount, updateAttendee, updateLineItem, deleteLineItem } from './actions'

interface Props {
  split: Tables<'splits'>
  attendees: Tables<'attendees'>[]
  attendeeGroups: Tables<'attendee_groups'>[]
  items: Tables<'items'>[]
  initialAssignments: Record<string, string[]>
  signedReceiptUrl: string | null
  discounts: Tables<'discounts'>[]
  discountAttendees: Tables<'discount_attendees'>[]
}

interface LineGroup {
  expanded: boolean
  combineUnits: boolean
  sharedAttendees: string[]
  unitAssignments: Record<string, string> // itemId → single attendeeId
}

function fmt(price: number) {
  return `$${price.toFixed(2)}`
}

function BackIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"
      stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"
      stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
      className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
      checked ? 'border-teal-600 bg-teal-600' : 'border-slate-300 bg-white'
    }`}>
      {checked && <CheckIcon />}
    </span>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
        checked ? 'bg-teal-600' : 'bg-slate-300'
      }`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
        checked ? 'translate-x-6' : 'translate-x-1'
      }`} />
    </button>
  )
}

export function SplitDetail({
  split,
  attendees,
  attendeeGroups,
  items,
  initialAssignments,
  signedReceiptUrl,
  discounts,
  discountAttendees,
}: Props) {
  const router = useRouter()

  const [assignments, setAssignments] = useState<Record<string, string[]>>(
    Object.fromEntries(items.map(item => [item.id, initialAssignments[item.id] ?? []]))
  )
  const [assignModalItemId, setAssignModalItemId] = useState<string | null>(null)
  const [assignSelected, setAssignSelected] = useState<string[]>([])
  const [showMerge, setShowMerge] = useState(false)
  const [mergeSelected, setMergeSelected] = useState<string[]>([])
  const [mergeLabel, setMergeLabel] = useState('')
  const [mergeLabelEdited, setMergeLabelEdited] = useState(false)
  const [mergeContactId, setMergeContactId] = useState<string | null>(null)
  const [showEditAttendees, setShowEditAttendees] = useState(false)
  const [editAttendeeId, setEditAttendeeId] = useState<string | null>(null)
  const [editAttendeeName, setEditAttendeeName] = useState('')
  const [editAttendeePhone, setEditAttendeePhone] = useState('')
  const [editAttendeeEmail, setEditAttendeeEmail] = useState('')
  const [editAttendeeError, setEditAttendeeError] = useState<string | null>(null)
  const [showReceiptFull, setShowReceiptFull] = useState(false)
  const [showAssignByLine, setShowAssignByLine] = useState(false)
  const [lineGroups, setLineGroups] = useState<Record<string, LineGroup>>({})
  const [scanning, setScanning] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAddCharge, setShowAddCharge] = useState(false)
  const [chargeType, setChargeType] = useState<'tip' | 'app' | 'service' | 'custom'>('tip')
  const [chargeDesc, setChargeDesc] = useState('')
  const [chargeAmount, setChargeAmount] = useState('')
  const [chargeAssignAll, setChargeAssignAll] = useState(true)
  const [appFeeMode, setAppFeeMode] = useState<'host' | 'individual'>('host')

  // Discount modal state
  const [showDiscount, setShowDiscount] = useState(false)
  const [discountType, setDiscountType] = useState<'percentage' | 'flat'>('percentage')
  const [discountValue, setDiscountValue] = useState('')
  const [discountAttendeeIds, setDiscountAttendeeIds] = useState<string[]>([])

  // Edit item modal
  const [editItemId, setEditItemId] = useState<string | null>(null)
  const [editItemDesc, setEditItemDesc] = useState('')
  const [editItemPrice, setEditItemPrice] = useState('')
  const [editItemError, setEditItemError] = useState<string | null>(null)

  // Delete item confirmation
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null)

  // Add item modal
  const [showAddItem, setShowAddItem] = useState(false)
  const [addItemDesc, setAddItemDesc] = useState('')
  const [addItemPrice, setAddItemPrice] = useState('')
  const [addItemError, setAddItemError] = useState<string | null>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAssignments(
      Object.fromEntries(items.map(item => [item.id, initialAssignments[item.id] ?? []]))
    )
  }, [items, initialAssignments])

  const subtotal = items.reduce((sum, item) => sum + item.price, 0)
  const allAssigned = items.length > 0 && items.every(i => (assignments[i.id] ?? []).length > 0)
  const totalAssigned = items.reduce(
    (sum, item) => ((assignments[item.id] ?? []).length > 0 ? sum + item.price : sum),
    0
  )
  const unassignedCount = items.filter(i => !(assignments[i.id] ?? []).length).length

  // The organiser is always the host for app fee purposes
  const hostAttendee = attendees.find(a => a.user_id === split.organiser_id) ?? null

  const itemsByDescription = items.reduce((map, item) => {
    if (!map[item.description]) map[item.description] = []
    map[item.description].push(item)
    return map
  }, {} as Record<string, Tables<'items'>[]>)

  // ── Scan receipt ─────────────────────────────────────────────────────────────

  async function handleScanReceipt() {
    if (!signedReceiptUrl) return
    setScanning(true)
    setError(null)
    try {
      const res = await fetch(signedReceiptUrl)
      const blob = await res.blob()
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve((reader.result as string).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
      const ocrRes = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 }),
      })
      if (!ocrRes.ok) throw new Error()
      const { items: ocrItems, total } = await ocrRes.json()
      if (!ocrItems?.length) {
        setError('No items detected in the receipt. Try again or contact support.')
        return
      }
      await saveItems(split.id, ocrItems, total)
      router.refresh()
    } catch {
      setError('Failed to scan receipt. Please try again.')
    } finally {
      setScanning(false)
    }
  }

  // ── Single-item assign modal ─────────────────────────────────────────────────

  function openAssignModal(itemId: string) {
    setAssignModalItemId(itemId)
    setAssignSelected(assignments[itemId] ?? [])
  }

  function toggleAssignSelect(id: string) {
    setAssignSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  function toggleAssignAll() {
    const allIds = attendees.map(a => a.id)
    setAssignSelected(prev =>
      allIds.every(id => prev.includes(id)) ? [] : allIds
    )
  }

  async function handleConfirmAssign() {
    if (!assignModalItemId) return
    const itemId = assignModalItemId
    const ids = assignSelected
    const newAssignments = { ...assignments, [itemId]: ids }
    setAssignments(newAssignments)

    // Auto-advance to the next unassigned item
    const currentIndex = items.findIndex(i => i.id === itemId)
    const nextUnassigned = items.slice(currentIndex + 1).find(i => !(newAssignments[i.id] ?? []).length)
    if (nextUnassigned) {
      setAssignModalItemId(nextUnassigned.id)
      setAssignSelected([])
    } else {
      setAssignModalItemId(null)
      setAssignSelected([])
    }

    await assignItem(itemId, ids)
  }

  // ── Equal split ──────────────────────────────────────────────────────────────

  async function handleEqualSplit() {
    setBusy(true)
    setError(null)
    try {
      await equalSplit(split.id)
      router.refresh()
    } catch {
      setError('Failed to split equally.')
    } finally {
      setBusy(false)
    }
  }

  // ── Assign by line ───────────────────────────────────────────────────────────

  function openAssignByLine() {
    const initial: Record<string, LineGroup> = {}
    for (const [desc, group] of Object.entries(itemsByDescription)) {
      const firstAssigned = assignments[group[0].id] ?? []
      const allSame = group.every(i => (assignments[i.id] ?? []).join() === firstAssigned.join())
      if (allSame && firstAssigned.length > 0) {
        initial[desc] = { expanded: false, combineUnits: true, sharedAttendees: firstAssigned, unitAssignments: {} }
      } else if (!allSame) {
        const unitAssignments: Record<string, string> = {}
        group.forEach(item => {
          const a = assignments[item.id] ?? []
          if (a.length === 1) unitAssignments[item.id] = a[0]
        })
        initial[desc] = { expanded: false, combineUnits: false, sharedAttendees: [], unitAssignments }
      } else {
        initial[desc] = { expanded: false, combineUnits: true, sharedAttendees: [], unitAssignments: {} }
      }
    }
    setLineGroups(initial)
    setShowAssignByLine(true)
  }

  function toggleGroupExpanded(desc: string) {
    setLineGroups(prev => ({
      ...prev,
      [desc]: { ...prev[desc], expanded: !prev[desc].expanded },
    }))
  }

  function toggleCombineUnits(desc: string) {
    setLineGroups(prev => {
      const g = prev[desc]
      return {
        ...prev,
        [desc]: {
          ...g,
          combineUnits: !g.combineUnits,
          sharedAttendees: !g.combineUnits ? [] : g.sharedAttendees,
          unitAssignments: g.combineUnits ? {} : g.unitAssignments,
        },
      }
    })
  }

  function toggleSharedAttendee(desc: string, attendeeId: string) {
    setLineGroups(prev => {
      const g = prev[desc]
      const current = g.sharedAttendees
      return {
        ...prev,
        [desc]: {
          ...g,
          sharedAttendees: current.includes(attendeeId)
            ? current.filter(id => id !== attendeeId)
            : [...current, attendeeId],
        },
      }
    })
  }

  function toggleSharedAll(desc: string) {
    const allIds = attendees.map(a => a.id)
    setLineGroups(prev => {
      const g = prev[desc]
      const allSelected = allIds.every(id => g.sharedAttendees.includes(id))
      return { ...prev, [desc]: { ...g, sharedAttendees: allSelected ? [] : allIds } }
    })
  }

  function setUnitAttendee(desc: string, itemId: string, attendeeId: string) {
    setLineGroups(prev => {
      const g = prev[desc]
      return {
        ...prev,
        [desc]: { ...g, unitAssignments: { ...g.unitAssignments, [itemId]: attendeeId } },
      }
    })
  }

  const lineGroupsHaveSelection = Object.values(lineGroups).some(g => {
    if (g.combineUnits) return g.sharedAttendees.length > 0
    return Object.values(g.unitAssignments).some(id => id)
  })

  async function handleConfirmAssignByLine() {
    setBusy(true)
    setError(null)
    try {
      const updates: Array<{ itemId: string; attendeeIds: string[] }> = []
      for (const [desc, g] of Object.entries(lineGroups)) {
        const group = itemsByDescription[desc] ?? []
        if (g.combineUnits) {
          if (g.sharedAttendees.length > 0) {
            group.forEach(item => updates.push({ itemId: item.id, attendeeIds: g.sharedAttendees }))
          }
        } else {
          group.forEach(item => {
            const id = g.unitAssignments[item.id]
            if (id) updates.push({ itemId: item.id, attendeeIds: [id] })
          })
        }
      }
      for (const u of updates) {
        await assignItem(u.itemId, u.attendeeIds)
      }
      setAssignments(prev => {
        const next = { ...prev }
        updates.forEach(u => { next[u.itemId] = u.attendeeIds })
        return next
      })
      setShowAssignByLine(false)
      setLineGroups({})
    } catch {
      setError('Failed to assign items.')
    } finally {
      setBusy(false)
    }
  }

  // ── Merge attendees ──────────────────────────────────────────────────────────

  function defaultMergeLabel(ids: string[]): string {
    const names = ids
      .map(id => attendees.find(a => a.id === id)?.display_name ?? '')
      .filter(Boolean)
      .map(n => {
        const parts = n.trim().split(/\s+/)
        return parts.length > 1 ? `${parts[0]} ${parts[1][0]}` : parts[0]
      })
    if (names.length === 0) return ''
    if (names.length === 2) return `${names[0]} and ${names[1]}`
    if (names.length > 2) return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
    return names[0]
  }

  function toggleMergeSelect(id: string) {
    const next = mergeSelected.includes(id)
      ? mergeSelected.filter(x => x !== id)
      : [...mergeSelected, id]
    setMergeSelected(next)
    if (!mergeLabelEdited) setMergeLabel(defaultMergeLabel(next))
    // Keep contact nomination valid — auto-pick first eligible if current is no longer selected
    const eligible = next
      .map(mid => attendees.find(a => a.id === mid))
      .filter((a): a is typeof attendees[number] => !!a && !!(a.phone || a.email))
    if (!eligible.find(a => a.id === mergeContactId)) {
      setMergeContactId(eligible[0]?.id ?? null)
    }
  }

  async function handleConfirmMerge() {
    if (mergeSelected.length < 2 || !mergeLabel.trim()) return
    setBusy(true)
    setError(null)
    try {
      const contactAttendee = attendees.find(a => a.id === mergeContactId)
      await mergeAttendees(
        split.id,
        mergeSelected,
        mergeLabel.trim(),
        contactAttendee?.phone ?? null,
        contactAttendee?.email ?? null,
      )
      setShowMerge(false)
      setMergeSelected([])
      setMergeLabel('')
      setMergeContactId(null)
      setMergeLabelEdited(false)
      router.refresh()
    } catch {
      setError('Failed to merge attendees.')
    } finally {
      setBusy(false)
    }
  }

  // ── Edit attendee ────────────────────────────────────────────────────────────

  function openEditAttendee(a: Tables<'attendees'>) {
    setEditAttendeeId(a.id)
    setEditAttendeeName(a.display_name)
    setEditAttendeePhone(a.phone ?? '')
    setEditAttendeeEmail(a.email ?? '')
    setEditAttendeeError(null)
  }

  async function handleSaveAttendee() {
    if (!editAttendeeId || !editAttendeeName.trim()) return
    setBusy(true)
    setEditAttendeeError(null)
    try {
      await updateAttendee(editAttendeeId, {
        display_name: editAttendeeName.trim(),
        phone: editAttendeePhone.trim() || null,
        email: editAttendeeEmail.trim() || null,
      })
      setEditAttendeeId(null)
      router.refresh()
    } catch {
      setEditAttendeeError('Failed to update attendee.')
    } finally {
      setBusy(false)
    }
  }

  // ── Add charge ───────────────────────────────────────────────────────────────

  async function handleAddCharge() {
    const desc =
      chargeType === 'tip' ? 'Tip' :
      chargeType === 'app' ? 'App fee' :
      chargeType === 'service' ? 'Service charge' :
      chargeDesc.trim()
    const totalEntered = Math.round(parseFloat(chargeAmount) * 100) / 100
    if (!desc || isNaN(totalEntered) || totalEntered <= 0) return

    let finalPrice = totalEntered
    let attendeeIds: string[] | null = chargeAssignAll ? null : []
    if (chargeType === 'app' && appFeeMode === 'individual') {
      const perPerson = totalEntered / attendees.length
      const nonHosts = hostAttendee
        ? attendees.filter(a => a.id !== hostAttendee.id)
        : attendees
      finalPrice = Math.round(perPerson * nonHosts.length * 100) / 100
      attendeeIds = nonHosts.map(a => a.id)
    }

    setBusy(true)
    setError(null)
    try {
      await addLineItem(split.id, desc, finalPrice, attendeeIds, items.length + 1)
      setShowAddCharge(false)
      setChargeType('tip')
      setChargeDesc('')
      setChargeAmount('')
      setChargeAssignAll(true)
      setAppFeeMode('host')
      router.refresh()
    } catch {
      setError('Failed to add charge.')
    } finally {
      setBusy(false)
    }
  }

  // ── Apply discount ───────────────────────────────────────────────────────────

  function openDiscountModal() {
    setDiscountType('percentage')
    setDiscountValue('')
    setDiscountAttendeeIds([])
    setShowDiscount(true)
  }

  function toggleDiscountAttendee(id: string) {
    setDiscountAttendeeIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  function toggleDiscountAll() {
    const allIds = attendees.map(a => a.id)
    setDiscountAttendeeIds(prev =>
      allIds.every(id => prev.includes(id)) ? [] : allIds
    )
  }

  async function handleApplyDiscount() {
    const val = parseFloat(discountValue)
    if (isNaN(val) || val <= 0 || discountAttendeeIds.length === 0) return
    if (discountType === 'percentage' && val > 100) return
    setBusy(true)
    setError(null)
    try {
      await applyDiscount(split.id, discountType, val, discountAttendeeIds)
      setShowDiscount(false)
      setDiscountValue('')
      setDiscountAttendeeIds([])
      router.refresh()
    } catch {
      setError('Failed to apply discount.')
    } finally {
      setBusy(false)
    }
  }

  // ── Edit line item ───────────────────────────────────────────────────────────

  function openEditItem(item: Tables<'items'>) {
    setEditItemId(item.id)
    setEditItemDesc(item.description)
    setEditItemPrice(item.price.toFixed(2))
    setEditItemError(null)
  }

  async function handleSaveItem() {
    if (!editItemId || !editItemDesc.trim()) return
    const price = Math.round(parseFloat(editItemPrice) * 100) / 100
    if (isNaN(price) || price <= 0) return
    setBusy(true)
    setEditItemError(null)
    try {
      await updateLineItem(editItemId, editItemDesc.trim(), price)
      setEditItemId(null)
      router.refresh()
    } catch {
      setEditItemError('Failed to update item.')
    } finally {
      setBusy(false)
    }
  }

  // ── Delete line item ─────────────────────────────────────────────────────────

  async function handleDeleteItem() {
    if (!deleteItemId) return
    setBusy(true)
    setError(null)
    try {
      await deleteLineItem(deleteItemId)
      setDeleteItemId(null)
      router.refresh()
    } catch {
      setError('Failed to remove item.')
    } finally {
      setBusy(false)
    }
  }

  // ── Add line item (manual) ───────────────────────────────────────────────────

  async function handleAddItem() {
    if (!addItemDesc.trim()) return
    const price = Math.round(parseFloat(addItemPrice) * 100) / 100
    if (isNaN(price) || price <= 0) return
    setBusy(true)
    setAddItemError(null)
    try {
      await addLineItem(split.id, addItemDesc.trim(), price, [], items.length + 1)
      setShowAddItem(false)
      setAddItemDesc('')
      setAddItemPrice('')
      router.refresh()
    } catch {
      setAddItemError('Failed to add item.')
    } finally {
      setBusy(false)
    }
  }

  async function handleUnmerge(groupId: string) {
    setBusy(true)
    setError(null)
    try {
      await unmergeGroup(groupId)
      router.refresh()
    } catch {
      setError('Failed to unmerge.')
    } finally {
      setBusy(false)
    }
  }

  async function handleRemoveDiscount(discountId: string) {
    setBusy(true)
    setError(null)
    try {
      await removeDiscount(discountId)
      router.refresh()
    } catch {
      setError('Failed to remove discount.')
    } finally {
      setBusy(false)
    }
  }

  // ── Finalise ─────────────────────────────────────────────────────────────────

  async function handleFinalise() {
    if (!allAssigned) return
    setBusy(true)
    setError(null)
    try {
      await finaliseSplit(split.id)
      router.push(`/splits/${split.id}/results`)
    } catch {
      setError('Failed to finalise split.')
      setBusy(false)
    }
  }

  const assignModalItem = assignModalItemId ? items.find(i => i.id === assignModalItemId) : null

  // ── No items yet ─────────────────────────────────────────────────────────────

  if (items.length === 0) {
    return (
      <>
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 pb-4 safe-top">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => router.push('/splits')} className="text-slate-400 hover:text-slate-600" aria-label="Go back">
              <BackIcon />
            </button>
            <h1 className="text-xl font-bold tracking-tight text-gwfc-blue">{split.title}</h1>
          </div>
        </header>

        <main className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
          {signedReceiptUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={signedReceiptUrl}
              alt="Receipt"
              className="mb-6 max-h-52 w-full max-w-xs rounded-xl object-contain shadow-sm ring-1 ring-slate-200"
            />
          )}
          <h2 className="text-lg font-semibold text-gwfc-blue">
            {signedReceiptUrl ? 'Scan your receipt' : 'No receipt uploaded'}
          </h2>
          <p className="mt-2 max-w-xs text-sm text-slate-500">
            {signedReceiptUrl
              ? 'Tap below to automatically extract line items using OCR.'
              : 'A receipt was not uploaded with this split.'}
          </p>
          {error && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}
          {signedReceiptUrl && (
            <button
              type="button"
              onClick={handleScanReceipt}
              disabled={scanning}
              className="mt-6 flex items-center gap-2 rounded-2xl bg-teal-600 px-6 py-3.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {scanning ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                  Scanning…
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2" />
                    <rect x="7" y="7" width="10" height="10" rx="1" />
                  </svg>
                  Scan Receipt
                </>
              )}
            </button>
          )}
        </main>
      </>
    )
  }

  // ── Item assignment UI ────────────────────────────────────────────────────────

  return (
    <>
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 pb-3 safe-top">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <button type="button" onClick={() => router.push('/splits')} className="shrink-0 text-slate-400 hover:text-slate-600" aria-label="Go back">
              <BackIcon />
            </button>
            <h1 className="truncate text-lg font-bold tracking-tight text-gwfc-blue">{split.title}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={openAssignByLine}
              disabled={busy}
              className="flex items-center gap-1 rounded-lg bg-violet-50 px-2.5 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-50"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                <circle cx="3" cy="6" r="0.5" fill="currentColor" /><circle cx="3" cy="12" r="0.5" fill="currentColor" /><circle cx="3" cy="18" r="0.5" fill="currentColor" />
              </svg>
              Assign
            </button>
            <button
              type="button"
              onClick={handleEqualSplit}
              disabled={busy}
              className="flex items-center gap-1 rounded-lg bg-sky-50 px-2.5 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-100 disabled:opacity-50"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="5" y1="12" x2="19" y2="12" />
                <circle cx="12" cy="6" r="1" fill="currentColor" stroke="none" />
                <circle cx="12" cy="18" r="1" fill="currentColor" stroke="none" />
              </svg>
              Equal
            </button>
            <button
              type="button"
              onClick={handleFinalise}
              disabled={!allAssigned || busy}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                allAssigned ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-slate-100 text-slate-400'
              }`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              Finalise
            </button>
          </div>
        </div>
      </header>

      <main className="space-y-4 px-4 py-4 pb-32">
        <div className="space-y-4">
          {signedReceiptUrl && (
            <button
              type="button"
              onClick={() => setShowReceiptFull(true)}
              className="block w-full overflow-hidden rounded-xl shadow-sm ring-1 ring-slate-200"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={signedReceiptUrl} alt="Receipt" className="max-h-28 w-full object-cover" />
              <p className="bg-slate-50 py-1.5 text-center text-xs text-slate-400">Tap to view full receipt</p>
            </button>
          )}

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => { setShowMerge(true); setMergeSelected([]); setMergeLabel(''); setMergeLabelEdited(false) }}
              className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="9" cy="8" r="3" />
                <circle cx="15" cy="8" r="3" />
                <path d="M3 20c0-3 2.7-5 6-5h6c3.3 0 6 2 6 5" />
              </svg>
              Merge attendees
            </button>
            <button
              type="button"
              onClick={() => setShowAddCharge(true)}
              className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
              Add charge
            </button>
            <button
              type="button"
              onClick={openDiscountModal}
              className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
              </svg>
              Apply discount
            </button>
            <button
              type="button"
              onClick={() => { setShowEditAttendees(true); setEditAttendeeId(null) }}
              className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit attendees
            </button>
          </div>

          {/* Applied merges summary */}
          {attendeeGroups.length > 0 && (
            <div className="space-y-1.5">
              {attendeeGroups.map(g => {
                const memberNames = attendees
                  .filter(a => a.group_id === g.id)
                  .map(a => a.display_name)
                  .join(', ')
                return (
                  <div key={g.id} className="flex items-center justify-between rounded-lg bg-teal-50 px-3 py-2 ring-1 ring-teal-100">
                    <p className="text-xs text-teal-700">
                      <span className="font-semibold">{g.label}</span>
                      {memberNames && <span className="text-teal-600"> · {memberNames}</span>}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleUnmerge(g.id)}
                      disabled={busy}
                      className="ml-2 shrink-0 text-teal-400 hover:text-teal-600 disabled:opacity-40"
                      aria-label="Unmerge"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Applied discounts summary */}
          {discounts.length > 0 && (
            <div className="space-y-1.5">
              {discounts.map(d => {
                const appliedIds = discountAttendees
                  .filter(da => da.discount_id === d.id)
                  .map(da => da.attendee_id)
                const names = appliedIds
                  .map(id => attendees.find(a => a.id === id)?.display_name ?? '?')
                  .join(', ')
                const label = d.type === 'percentage'
                  ? `${d.value}% off`
                  : `${fmt(d.value)} off`
                return (
                  <div key={d.id} className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 ring-1 ring-emerald-100">
                    <p className="text-xs text-emerald-700">
                      <span className="font-semibold">{label}</span>
                      {names && <span className="text-emerald-600"> · {names}</span>}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleRemoveDiscount(d.id)}
                      disabled={busy}
                      className="ml-2 shrink-0 text-emerald-400 hover:text-emerald-600 disabled:opacity-40"
                      aria-label="Remove discount"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <ul className="space-y-2">
            {items.map(item => {
              const assigned = assignments[item.id] ?? []
              const isAssigned = assigned.length > 0
              const perPerson = isAssigned ? item.price / assigned.length : null
              return (
                <li
                  key={item.id}
                  className={`rounded-2xl px-4 py-3 shadow-sm ring-1 ${
                    isAssigned ? 'bg-white ring-slate-200' : 'bg-amber-50 ring-amber-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gwfc-blue">{item.description}</p>
                      {isAssigned ? (
                        <p className="mt-0.5 truncate text-xs text-slate-400">
                          {assigned
                            .map(id => attendees.find(a => a.id === id)?.display_name ?? '?')
                            .join(', ')}
                          {assigned.length > 1 && ` · ${fmt(perPerson!)} each`}
                        </p>
                      ) : (
                        <p className="mt-0.5 text-xs text-amber-600">Unassigned</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditItem(item)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        aria-label="Edit item"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <span className="text-sm font-semibold text-gwfc-blue">{fmt(item.price)}</span>
                      <button
                        type="button"
                        onClick={() => openAssignModal(item.id)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                          isAssigned
                            ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            : 'bg-amber-500 text-white hover:bg-amber-600'
                        }`}
                      >
                        {isAssigned ? 'Edit' : 'Assign'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteItemId(item.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500"
                        aria-label="Remove item"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M3 6h18" />
                          <path d="M8 6V4h8v2" />
                          <path d="M19 6l-1 14H6L5 6" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>

          <button
            type="button"
            onClick={() => { setShowAddItem(true); setAddItemDesc(''); setAddItemPrice(''); setAddItemError(null) }}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 py-3 text-sm font-medium text-slate-500 hover:border-teal-400 hover:text-teal-600"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add item
          </button>
        </div>
      </main>

      {/* Summary bar */}
      <div className="fixed inset-x-0 border-t border-slate-200 bg-white px-4 py-2.5" style={{ bottom: 'calc(4rem + max(env(safe-area-inset-bottom), 12px))' }}>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">
            Assigned: <span className="font-semibold text-gwfc-blue">{fmt(totalAssigned)}</span>
          </span>
          {split.total != null && (
            <span className="text-slate-500">
              Total: <span className="font-semibold text-gwfc-blue">{fmt(split.total)}</span>
            </span>
          )}
          {unassignedCount > 0 && (
            <span className="text-xs font-medium text-amber-600">
              {unassignedCount} unassigned
            </span>
          )}
        </div>
      </div>

      {/* Receipt full-size overlay */}
      {showReceiptFull && signedReceiptUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setShowReceiptFull(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={signedReceiptUrl} alt="Receipt" className="max-h-full max-w-full rounded-xl object-contain" />
        </div>
      )}

      {/* ── Single-item assign bottom sheet ─────────────────────────────────── */}
      {assignModalItemId && assignModalItem && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="fixed inset-0 bg-black/40" onClick={() => setAssignModalItemId(null)} />
          <div className="relative flex max-h-[80vh] w-full flex-col rounded-t-2xl bg-white shadow-xl">
            <div className="shrink-0 border-b border-slate-100 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Assign item</p>
              <p className="mt-1 truncate text-sm font-semibold text-gwfc-blue">{assignModalItem.description}</p>
              <p className="text-sm text-slate-500">{fmt(assignModalItem.price)}</p>
            </div>
            <div className="flex-1 overflow-y-auto">
              <button
                type="button"
                onClick={toggleAssignAll}
                className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 hover:bg-slate-50"
              >
                <Checkbox checked={attendees.length > 0 && attendees.every(a => assignSelected.includes(a.id))} />
                <p className="text-sm font-medium text-slate-500">Select all</p>
              </button>
              {attendees.map(a => {
                const sel = assignSelected.includes(a.id)
                const share = assignSelected.length > 0 && sel
                  ? fmt(assignModalItem.price / assignSelected.length)
                  : null
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggleAssignSelect(a.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 hover:bg-slate-50"
                  >
                    <Checkbox checked={sel} />
                    <div className="min-w-0 flex-1 text-left">
                      <p className="truncate text-sm font-medium text-gwfc-blue">{a.display_name}</p>
                      {share && <p className="text-xs text-slate-400">{share} each</p>}
                    </div>
                  </button>
                )
              })}
            </div>
            <div className="shrink-0 border-t border-slate-100 bg-white px-4 py-4">
              <button
                type="button"
                onClick={handleConfirmAssign}
                disabled={assignSelected.length === 0}
                className="w-full rounded-2xl bg-teal-600 py-3 text-sm font-semibold text-white disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Assign by line bottom sheet ──────────────────────────────────────── */}
      {showAssignByLine && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="fixed inset-0 bg-black/40" onClick={() => setShowAssignByLine(false)} />
          <div className="relative flex max-h-[90vh] w-full flex-col rounded-t-2xl bg-white shadow-xl">
            <div className="shrink-0 border-b border-slate-100 px-4 py-4">
              <p className="text-sm font-semibold text-gwfc-blue">Assign by line</p>
              <p className="mt-0.5 text-xs text-slate-400">Expand each item to assign it. All matching rows are updated at once.</p>
            </div>

            <div className="flex-1 overflow-y-auto">
              {Object.entries(lineGroups).map(([desc, g]) => {
                const group = itemsByDescription[desc] ?? []
                const total = group.reduce((s, i) => s + i.price, 0)
                const selCount = g.combineUnits
                  ? g.sharedAttendees.length
                  : Object.values(g.unitAssignments).filter(Boolean).length
                const allSharedSelected = attendees.length > 0 && attendees.every(a => g.sharedAttendees.includes(a.id))

                return (
                  <div key={desc} className="border-b border-slate-100 last:border-0">
                    <button
                      type="button"
                      onClick={() => toggleGroupExpanded(desc)}
                      className="flex w-full items-center gap-3 px-4 py-3.5 hover:bg-slate-50"
                    >
                      <div className="min-w-0 flex-1 text-left">
                        <p className="truncate text-sm font-semibold text-gwfc-blue">{desc}</p>
                        <p className="text-xs text-slate-400">
                          {group.length > 1 ? `${group.length}× · ` : ''}{fmt(total)}
                          {selCount > 0 && (
                            <span className="ml-1.5 font-medium text-slate-600">
                              · {g.combineUnits
                                  ? `${selCount === attendees.length ? 'All' : selCount} selected`
                                  : `${selCount} of ${group.length} assigned`}
                            </span>
                          )}
                        </p>
                      </div>
                      <ChevronDown open={g.expanded} />
                    </button>

                    {g.expanded && (
                      <div className="border-t border-slate-100 bg-slate-50/50 pb-2">
                        {group.length > 1 && (
                          <div className="flex items-center justify-between px-4 py-3">
                            <div>
                              <p className="text-sm font-medium text-gwfc-blue">Combine units</p>
                              <p className="text-xs text-slate-400">
                                {g.combineUnits
                                  ? 'Cost shared equally among selected people'
                                  : 'Each unit assigned to a different person'}
                              </p>
                            </div>
                            <Toggle checked={g.combineUnits} onChange={() => toggleCombineUnits(desc)} />
                          </div>
                        )}

                        {g.combineUnits ? (
                          <div className="mt-1">
                            <button
                              type="button"
                              onClick={() => toggleSharedAll(desc)}
                              className="flex w-full items-center gap-3 px-4 py-2.5 hover:bg-slate-100"
                            >
                              <Checkbox checked={allSharedSelected} />
                              <p className="text-sm text-slate-500">Select all</p>
                            </button>
                            {attendees.map(a => {
                              const sel = g.sharedAttendees.includes(a.id)
                              const share = g.sharedAttendees.length > 0 && sel
                                ? fmt(total / g.sharedAttendees.length)
                                : null
                              return (
                                <button
                                  key={a.id}
                                  type="button"
                                  onClick={() => toggleSharedAttendee(desc, a.id)}
                                  className="flex w-full items-center gap-3 px-4 py-2.5 hover:bg-slate-100"
                                >
                                  <Checkbox checked={sel} />
                                  <div className="min-w-0 flex-1 text-left">
                                    <p className="truncate text-sm font-medium text-gwfc-blue">{a.display_name}</p>
                                    {share && <p className="text-xs text-slate-400">{share} each</p>}
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                        ) : (
                          <div className="mt-1 space-y-1 px-4 pb-1">
                            {group.map((item, idx) => (
                              <div key={item.id} className="flex items-center gap-3">
                                <p className="w-14 shrink-0 text-xs text-slate-400">Unit {idx + 1}</p>
                                <select
                                  value={g.unitAssignments[item.id] ?? ''}
                                  onChange={e => setUnitAttendee(desc, item.id, e.target.value)}
                                  className="flex-1 rounded-lg px-2 py-2 text-sm text-gwfc-blue shadow-sm ring-1 ring-slate-300 outline-none focus:ring-2 focus:ring-teal-500"
                                >
                                  <option value="">Unassigned</option>
                                  {attendees.map(a => (
                                    <option key={a.id} value={a.id}>{a.display_name}</option>
                                  ))}
                                </select>
                                <span className="w-14 shrink-0 text-right text-xs text-slate-400">{fmt(item.price)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-4">
              <button
                type="button"
                onClick={handleConfirmAssignByLine}
                disabled={busy || !lineGroupsHaveSelection}
                className="w-full rounded-2xl bg-teal-600 py-3.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                {busy ? 'Saving…' : 'Save assignments'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit attendees sheet ────────────────────────────────────────────── */}
      {showEditAttendees && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="fixed inset-0 bg-black/40" onClick={() => { setShowEditAttendees(false); setEditAttendeeId(null) }} />
          <div className="relative flex max-h-[80vh] w-full flex-col rounded-t-2xl bg-white shadow-xl">
            {editAttendeeId === null ? (
              <>
                <div className="shrink-0 border-b border-slate-100 px-4 py-4 flex items-center justify-between">
                  <p className="text-sm font-semibold text-gwfc-blue">Edit attendees</p>
                  <button type="button" onClick={() => setShowEditAttendees(false)} className="text-slate-400 hover:text-slate-600" aria-label="Close">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {attendees.map(a => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => openEditAttendee(a)}
                      className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5 last:border-0 hover:bg-slate-50 active:bg-slate-100"
                    >
                      <div className="min-w-0 text-left">
                        <p className="truncate text-sm font-medium text-gwfc-blue">{a.display_name}</p>
                        {(a.phone || a.email) && (
                          <p className="truncate text-xs text-slate-400">{a.phone ?? a.email}</p>
                        )}
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"
                        stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
                        className="shrink-0 text-slate-300">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="shrink-0 border-b border-slate-100 px-4 py-4 flex items-center gap-3">
                  <button type="button" onClick={() => setEditAttendeeId(null)} className="text-slate-400 hover:text-slate-600" aria-label="Back">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M15 18l-6-6 6-6" />
                    </svg>
                  </button>
                  <p className="text-sm font-semibold text-gwfc-blue">Edit attendee</p>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                  {editAttendeeError && (
                    <p className="text-sm text-red-500">{editAttendeeError}</p>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Name *</label>
                    <input
                      type="text"
                      value={editAttendeeName}
                      onChange={e => setEditAttendeeName(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-gwfc-blue placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={editAttendeePhone}
                      onChange={e => setEditAttendeePhone(e.target.value)}
                      placeholder="Optional"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-gwfc-blue placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                    <input
                      type="email"
                      value={editAttendeeEmail}
                      onChange={e => setEditAttendeeEmail(e.target.value)}
                      placeholder="Optional"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-gwfc-blue placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveAttendee}
                    disabled={!editAttendeeName.trim() || busy}
                    className="w-full rounded-2xl bg-gwfc-blue py-3.5 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    {busy ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Merge modal ─────────────────────────────────────────────────────── */}
      {showMerge && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="fixed inset-0 bg-black/40" onClick={() => { setShowMerge(false); setMergeLabelEdited(false) }} />
          <div className="relative w-full rounded-t-2xl bg-white shadow-xl">
            <div className="border-b border-slate-100 px-4 py-4">
              <p className="text-sm font-semibold text-gwfc-blue">Merge attendees</p>
              <p className="mt-0.5 text-xs text-slate-400">Select two or more people to combine into a group.</p>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {attendees.map(a => {
                const sel = mergeSelected.includes(a.id)
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggleMergeSelect(a.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 hover:bg-slate-50"
                  >
                    <Checkbox checked={sel} />
                    <p className="truncate text-sm font-medium text-gwfc-blue">{a.display_name}</p>
                  </button>
                )
              })}
            </div>
            <div className="space-y-3 border-t border-slate-100 px-4 py-4">
              <input
                type="text"
                placeholder="Group label (e.g. Sam & Alex)"
                value={mergeLabel}
                onChange={e => { setMergeLabel(e.target.value); setMergeLabelEdited(true) }}
                className="w-full rounded-lg px-3 py-2.5 text-sm text-gwfc-blue placeholder-slate-400 shadow-sm ring-1 ring-slate-300 outline-none focus:ring-2 focus:ring-teal-500"
              />
              {/* Contact nomination — only shown when 2+ selected and multiple have contact info */}
              {(() => {
                const eligible = mergeSelected
                  .map(mid => attendees.find(a => a.id === mid))
                  .filter((a): a is typeof attendees[number] => !!a && !!(a.phone || a.email))
                if (eligible.length < 2) return null
                return (
                  <div>
                    <p className="mb-2 text-xs font-medium text-slate-500">Send group messages to</p>
                    <div className="space-y-1">
                      {eligible.map(a => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => setMergeContactId(a.id)}
                          className="flex w-full items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-50"
                        >
                          <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                            mergeContactId === a.id ? 'border-teal-600 bg-teal-600' : 'border-slate-300 bg-white'
                          }`}>
                            {mergeContactId === a.id && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                          </span>
                          <div className="min-w-0 text-left">
                            <span className="text-sm text-gwfc-blue">{a.display_name}</span>
                            <span className="ml-2 text-xs text-slate-400">{a.phone ?? a.email}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })()}
              <button
                type="button"
                onClick={handleConfirmMerge}
                disabled={mergeSelected.length < 2 || !mergeLabel.trim() || busy}
                className="w-full rounded-2xl bg-teal-600 py-3 text-sm font-semibold text-white disabled:opacity-40"
              >
                Merge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add charge bottom sheet ──────────────────────────────────────────── */}
      {showAddCharge && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="fixed inset-0 bg-black/40" onClick={() => setShowAddCharge(false)} />
          <div className="relative w-full rounded-t-2xl bg-white shadow-xl">
            <div className="border-b border-slate-100 px-4 py-4">
              <p className="text-sm font-semibold text-gwfc-blue">Add charge</p>
              <p className="mt-0.5 text-xs text-slate-400">Add a tip, fee, or other charge to the bill.</p>
            </div>

            <div className="space-y-4 px-4 py-4">
              {/* Type chips */}
              <div className="grid grid-cols-4 gap-2">
                {([
                  { value: 'tip',     label: 'Tip' },
                  { value: 'app',     label: 'App fee' },
                  { value: 'service', label: 'Service' },
                  { value: 'custom',  label: 'Custom' },
                ] as const).map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { setChargeType(opt.value); setChargeAmount(''); setAppFeeMode('host') }}
                    className={`rounded-lg py-2 text-xs font-medium transition-colors ${
                      chargeType === opt.value
                        ? 'bg-teal-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Custom description */}
              {chargeType === 'custom' && (
                <input
                  type="text"
                  placeholder="Description"
                  value={chargeDesc}
                  onChange={e => setChargeDesc(e.target.value)}
                  className="w-full rounded-lg px-3 py-2.5 text-sm text-gwfc-blue placeholder-slate-400 shadow-sm ring-1 ring-slate-300 outline-none focus:ring-2 focus:ring-teal-500"
                />
              )}

              {/* Tip percentage shortcuts */}
              {chargeType === 'tip' && subtotal > 0 && (
                <div>
                  <p className="mb-2 text-xs text-slate-400">Bill subtotal: {fmt(subtotal)}</p>
                  <div className="flex gap-2">
                    {[10, 15, 18, 20].map(pct => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setChargeAmount((Math.round(subtotal * pct) / 100).toFixed(2))}
                        className="flex-1 rounded-lg bg-slate-100 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200"
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* App fee payment mode */}
              {chargeType === 'app' && (
                <div className="space-y-3 rounded-xl bg-slate-50 p-3">
                  <p className="text-xs font-medium text-slate-600">How was the fee charged?</p>
                  <div className="flex gap-2">
                    {([
                      { value: 'host',       label: 'Host paid total' },
                      { value: 'individual', label: 'Per person' },
                    ] as const).map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setAppFeeMode(opt.value)}
                        className={`flex-1 rounded-lg py-2 text-xs font-medium transition-colors ${
                          appFeeMode === opt.value
                            ? 'bg-teal-600 text-white'
                            : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {appFeeMode === 'host' && (
                    <p className="text-xs text-slate-400">
                      Full fee split equally — each person reimburses the host their share.
                    </p>
                  )}

                  {appFeeMode === 'individual' && (
                    <>
                      <p className="text-xs text-slate-400">
                        Each person is billed their own share. The host pays the app directly and is excluded from the split.
                      </p>
                      <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-2.5 ring-1 ring-slate-200">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-400" aria-hidden="true">
                          <circle cx="12" cy="8" r="4" />
                          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                        </svg>
                        {hostAttendee ? (
                          <p className="text-sm font-medium text-gwfc-blue">{hostAttendee.display_name}</p>
                        ) : (
                          <p className="text-sm text-slate-400">Host not listed as an attendee</p>
                        )}
                      </div>
                    </>
                  )}

                  {/* Breakdown preview */}
                  {chargeAmount && !isNaN(parseFloat(chargeAmount)) && parseFloat(chargeAmount) > 0 && (() => {
                    const total = parseFloat(chargeAmount)
                    const perPerson = total / attendees.length
                    if (appFeeMode === 'host') {
                      return (
                        <p className="text-xs text-slate-500">
                          {fmt(total)} ÷ {attendees.length} people = <span className="font-medium text-slate-700">{fmt(perPerson)} each</span>
                        </p>
                      )
                    }
                    const nonHostCount = attendees.length - (hostAttendee ? 1 : 0)
                    return (
                      <div className="space-y-0.5 text-xs text-slate-500">
                        <p>{attendees.length} people × {fmt(perPerson)} = {fmt(total)} total</p>
                        <p className="font-medium text-slate-700">{nonHostCount} attendees charged {fmt(perPerson)} each in split</p>
                        {hostAttendee && <p className="text-slate-400">{hostAttendee.display_name} pays {fmt(perPerson)} directly to app provider</p>}
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* Amount */}
              <div className="flex items-center gap-2 rounded-lg px-3 shadow-sm ring-1 ring-slate-300 focus-within:ring-2 focus-within:ring-teal-500">
                <span className="text-sm font-medium text-slate-400">$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={chargeAmount}
                  onChange={e => setChargeAmount(e.target.value)}
                  className="flex-1 py-2.5 text-sm text-gwfc-blue placeholder-slate-400 outline-none"
                />
              </div>

              {/* Split equally toggle — hidden for app fee (handled by mode above) */}
              {chargeType !== 'app' && (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gwfc-blue">Split equally</p>
                    <p className="text-xs text-slate-400">Assign to all attendees automatically</p>
                  </div>
                  <Toggle checked={chargeAssignAll} onChange={() => setChargeAssignAll(v => !v)} />
                </div>
              )}

              <button
                type="button"
                onClick={handleAddCharge}
                disabled={
                  !chargeAmount || parseFloat(chargeAmount) <= 0 ||
                  (chargeType === 'custom' && !chargeDesc.trim()) || busy
                }
                className="w-full rounded-2xl bg-teal-600 py-3 text-sm font-semibold text-white disabled:opacity-40"
              >
                {busy ? 'Adding…' : 'Add to bill'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit item bottom sheet ──────────────────────────────────────────── */}
      {editItemId && (() => {
        const editItem = items.find(i => i.id === editItemId)
        if (!editItem) return null
        return (
          <div className="fixed inset-0 z-50 flex items-end">
            <div className="fixed inset-0 bg-black/40" onClick={() => setEditItemId(null)} />
            <div className="relative w-full rounded-t-2xl bg-white shadow-xl">
              <div className="border-b border-slate-100 px-4 py-4">
                <p className="text-sm font-semibold text-gwfc-blue">Edit item</p>
                <p className="mt-0.5 text-xs text-slate-400">Update the description or amount for this item.</p>
              </div>
              <div className="space-y-3 px-4 py-4">
                {editItemError && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{editItemError}</p>
                )}
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Description</label>
                  <input
                    type="text"
                    value={editItemDesc}
                    onChange={e => setEditItemDesc(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-gwfc-blue placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Amount</label>
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-500">
                    <span className="text-sm font-medium text-slate-400">$</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={editItemPrice}
                      onChange={e => setEditItemPrice(e.target.value)}
                      className="flex-1 py-2.5 text-sm text-gwfc-blue placeholder:text-slate-400 outline-none"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSaveItem}
                  disabled={!editItemDesc.trim() || !editItemPrice || parseFloat(editItemPrice) <= 0 || busy}
                  className="w-full rounded-2xl bg-teal-600 py-3 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {busy ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Delete item confirmation sheet ───────────────────────────────────── */}
      {deleteItemId && (() => {
        const deleteItem = items.find(i => i.id === deleteItemId)
        if (!deleteItem) return null
        return (
          <div className="fixed inset-0 z-50 flex items-end">
            <div className="fixed inset-0 bg-black/40" onClick={() => setDeleteItemId(null)} />
            <div className="relative w-full rounded-t-2xl bg-white shadow-xl">
              <div className="border-b border-slate-100 px-4 py-4">
                <p className="text-sm font-semibold text-gwfc-blue">Remove item</p>
              </div>
              <div className="px-4 py-4">
                <p className="text-sm text-slate-600">
                  Remove <span className="font-semibold text-gwfc-blue">{deleteItem.description}</span> ({fmt(deleteItem.price)}) from the bill?
                </p>
                <p className="mt-1 text-xs text-slate-400">Any assignments for this item will also be removed.</p>
                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setDeleteItemId(null)}
                    className="flex-1 rounded-2xl bg-slate-100 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteItem}
                    disabled={busy}
                    className="flex-1 rounded-2xl bg-red-500 py-3 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-40"
                  >
                    {busy ? 'Removing…' : 'Remove'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Add item bottom sheet ────────────────────────────────────────────── */}
      {showAddItem && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="fixed inset-0 bg-black/40" onClick={() => setShowAddItem(false)} />
          <div className="relative w-full rounded-t-2xl bg-white shadow-xl">
            <div className="border-b border-slate-100 px-4 py-4">
              <p className="text-sm font-semibold text-gwfc-blue">Add item</p>
              <p className="mt-0.5 text-xs text-slate-400">Manually add a line item. It will appear as unassigned.</p>
            </div>
            <div className="space-y-3 px-4 py-4">
              {addItemError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{addItemError}</p>
              )}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Description</label>
                <input
                  type="text"
                  placeholder="e.g. Sparkling water"
                  value={addItemDesc}
                  onChange={e => setAddItemDesc(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-gwfc-blue placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Amount</label>
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-500">
                  <span className="text-sm font-medium text-slate-400">$</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={addItemPrice}
                    onChange={e => setAddItemPrice(e.target.value)}
                    className="flex-1 py-2.5 text-sm text-gwfc-blue placeholder:text-slate-400 outline-none"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleAddItem}
                disabled={!addItemDesc.trim() || !addItemPrice || parseFloat(addItemPrice) <= 0 || busy}
                className="w-full rounded-2xl bg-teal-600 py-3 text-sm font-semibold text-white disabled:opacity-40"
              >
                {busy ? 'Adding…' : 'Add to bill'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Apply discount bottom sheet ──────────────────────────────────────── */}
      {showDiscount && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="fixed inset-0 bg-black/40" onClick={() => setShowDiscount(false)} />
          <div className="relative flex max-h-[85vh] w-full flex-col rounded-t-2xl bg-white shadow-xl">
            <div className="shrink-0 border-b border-slate-100 px-4 py-4">
              <p className="text-sm font-semibold text-gwfc-blue">Apply discount</p>
              <p className="mt-0.5 text-xs text-slate-400">Reduce the total for selected attendees.</p>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="space-y-4 px-4 py-4">
                {/* Type toggle */}
                <div className="flex gap-2">
                  {([
                    { value: 'percentage', label: 'Percentage' },
                    { value: 'flat',       label: 'Dollar amount' },
                  ] as const).map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => { setDiscountType(opt.value); setDiscountValue('') }}
                      className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors ${
                        discountType === opt.value
                          ? 'bg-teal-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* Value input */}
                <div className="flex items-center gap-2 rounded-lg px-3 shadow-sm ring-1 ring-slate-300 focus-within:ring-2 focus-within:ring-teal-500">
                  {discountType === 'flat' && (
                    <span className="text-sm font-medium text-slate-400">$</span>
                  )}
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder={discountType === 'percentage' ? '0' : '0.00'}
                    min="0"
                    max={discountType === 'percentage' ? '100' : undefined}
                    value={discountValue}
                    onChange={e => setDiscountValue(e.target.value)}
                    className="flex-1 py-2.5 text-sm text-gwfc-blue placeholder-slate-400 outline-none"
                  />
                  {discountType === 'percentage' && (
                    <span className="text-sm font-medium text-slate-400">%</span>
                  )}
                </div>

                {/* Attendee selector */}
                <div>
                  <p className="mb-2 text-xs font-medium text-slate-500">Apply to</p>
                  <div className="overflow-hidden rounded-xl ring-1 ring-slate-200">
                    <button
                      type="button"
                      onClick={toggleDiscountAll}
                      className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 hover:bg-slate-50"
                    >
                      <Checkbox checked={attendees.length > 0 && attendees.every(a => discountAttendeeIds.includes(a.id))} />
                      <p className="text-sm font-medium text-slate-500">Select all</p>
                    </button>
                    {attendees.map(a => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => toggleDiscountAttendee(a.id)}
                        className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-0 hover:bg-slate-50"
                      >
                        <Checkbox checked={discountAttendeeIds.includes(a.id)} />
                        <p className="truncate text-sm font-medium text-gwfc-blue">{a.display_name}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="shrink-0 border-t border-slate-100 bg-white px-4 py-4">
              <button
                type="button"
                onClick={handleApplyDiscount}
                disabled={
                  !discountValue ||
                  parseFloat(discountValue) <= 0 ||
                  (discountType === 'percentage' && parseFloat(discountValue) > 100) ||
                  discountAttendeeIds.length === 0 ||
                  busy
                }
                className="w-full rounded-2xl bg-teal-600 py-3 text-sm font-semibold text-white disabled:opacity-40"
              >
                {busy ? 'Applying…' : 'Apply discount'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
