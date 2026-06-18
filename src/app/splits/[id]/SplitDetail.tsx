'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Tables } from '@/types/database'
import { saveItems, assignItem, mergeAttendees, finaliseSplit, equalSplit } from './actions'

interface Props {
  split: Tables<'splits'>
  attendees: Tables<'attendees'>[]
  attendeeGroups: Tables<'attendee_groups'>[]
  items: Tables<'items'>[]
  initialAssignments: Record<string, string[]>
  signedReceiptUrl: string | null
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
      checked ? 'border-zinc-900 bg-zinc-900' : 'border-zinc-300 bg-white'
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
        checked ? 'bg-zinc-900' : 'bg-zinc-300'
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
  attendeeGroups: _attendeeGroups,
  items,
  initialAssignments,
  signedReceiptUrl,
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
  const [showReceiptFull, setShowReceiptFull] = useState(false)
  const [showAssignByLine, setShowAssignByLine] = useState(false)
  const [lineGroups, setLineGroups] = useState<Record<string, LineGroup>>({})
  const [scanning, setScanning] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rawText, setRawText] = useState<string | null>(null)
  const [showRawText, setShowRawText] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAssignments(
      Object.fromEntries(items.map(item => [item.id, initialAssignments[item.id] ?? []]))
    )
  }, [items, initialAssignments])

  const allAssigned = items.length > 0 && items.every(i => (assignments[i.id] ?? []).length > 0)
  const totalAssigned = items.reduce(
    (sum, item) => ((assignments[item.id] ?? []).length > 0 ? sum + item.price : sum),
    0
  )
  const unassignedCount = items.filter(i => !(assignments[i.id] ?? []).length).length

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
      const { items: ocrItems, total, rawText: raw } = await ocrRes.json()
      setRawText(raw ?? null)
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
    setAssignments(prev => ({ ...prev, [itemId]: ids }))
    setAssignModalItemId(null)
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
        // All units already assigned the same way — pre-populate combined
        initial[desc] = { expanded: false, combineUnits: true, sharedAttendees: firstAssigned, unitAssignments: {} }
      } else if (!allSame) {
        // Mixed assignments — default to per-unit
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
          // clear incompatible selections when switching modes
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

  function toggleMergeSelect(id: string) {
    setMergeSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  async function handleConfirmMerge() {
    if (mergeSelected.length < 2 || !mergeLabel.trim()) return
    setBusy(true)
    setError(null)
    try {
      await mergeAttendees(split.id, mergeSelected, mergeLabel.trim())
      setShowMerge(false)
      setMergeSelected([])
      setMergeLabel('')
      router.refresh()
    } catch {
      setError('Failed to merge attendees.')
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
        <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white px-4 py-4">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => router.back()} className="text-zinc-400 hover:text-zinc-600" aria-label="Go back">
              <BackIcon />
            </button>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900">{split.title}</h1>
          </div>
        </header>

        <main className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
          {signedReceiptUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={signedReceiptUrl}
              alt="Receipt"
              className="mb-6 max-h-52 w-full max-w-xs rounded-xl object-contain shadow-sm ring-1 ring-zinc-200"
            />
          )}
          <h2 className="text-lg font-semibold text-zinc-900">
            {signedReceiptUrl ? 'Scan your receipt' : 'No receipt uploaded'}
          </h2>
          <p className="mt-2 max-w-xs text-sm text-zinc-500">
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
              className="mt-6 flex items-center gap-2 rounded-2xl bg-zinc-900 px-6 py-3.5 text-sm font-semibold text-white disabled:opacity-50"
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
          {rawText && (
            <div className="mt-6 w-full max-w-xs rounded-xl bg-zinc-50 ring-1 ring-zinc-200">
              <button
                type="button"
                onClick={() => setShowRawText(v => !v)}
                className="flex w-full items-center justify-between px-4 py-3 text-xs font-medium text-zinc-500"
              >
                Raw OCR output
                <span aria-hidden="true">{showRawText ? '▲' : '▼'}</span>
              </button>
              {showRawText && (
                <pre className="max-h-64 overflow-y-auto border-t border-zinc-200 p-4 text-xs text-zinc-600 font-mono whitespace-pre-wrap break-words">
                  {rawText}
                </pre>
              )}
            </div>
          )}
        </main>
      </>
    )
  }

  // ── Item assignment UI ────────────────────────────────────────────────────────

  return (
    <>
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <button type="button" onClick={() => router.back()} className="shrink-0 text-zinc-400 hover:text-zinc-600" aria-label="Go back">
              <BackIcon />
            </button>
            <h1 className="truncate text-lg font-bold tracking-tight text-zinc-900">{split.title}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={openAssignByLine}
              disabled={busy}
              className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-200 disabled:opacity-50"
            >
              Assign by line
            </button>
            <button
              type="button"
              onClick={handleEqualSplit}
              disabled={busy}
              className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-200 disabled:opacity-50"
            >
              Split equally
            </button>
            <button
              type="button"
              onClick={handleFinalise}
              disabled={!allAssigned || busy}
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Finalise
            </button>
          </div>
        </div>
      </header>

      <main className="flex flex-1 gap-3 px-4 py-4 pb-28">
        {/* Raw OCR panel */}
        {rawText && (
          <div className="w-2/5 shrink-0">
            <div className="sticky top-20 overflow-hidden rounded-xl bg-zinc-50 ring-1 ring-zinc-200">
              <button
                type="button"
                onClick={() => setShowRawText(v => !v)}
                className="flex w-full items-center justify-between px-3 py-2.5 text-xs font-medium text-zinc-500"
              >
                Raw OCR
                <span aria-hidden="true">{showRawText ? '▲' : '▼'}</span>
              </button>
              {showRawText && (
                <pre className="max-h-[60vh] overflow-y-auto border-t border-zinc-200 p-3 text-xs text-zinc-600 font-mono whitespace-pre-wrap break-words">
                  {rawText}
                </pre>
              )}
            </div>
          </div>
        )}

        {/* Main content */}
        <div className="min-w-0 flex-1 space-y-4">
          {signedReceiptUrl && (
            <button
              type="button"
              onClick={() => setShowReceiptFull(true)}
              className="block w-full overflow-hidden rounded-xl shadow-sm ring-1 ring-zinc-200"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={signedReceiptUrl} alt="Receipt" className="max-h-28 w-full object-cover" />
              <p className="bg-zinc-50 py-1.5 text-center text-xs text-zinc-400">Tap to view full receipt</p>
            </button>
          )}

          <button
            type="button"
            onClick={() => { setShowMerge(true); setMergeSelected([]); setMergeLabel('') }}
            className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-600"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="9" cy="8" r="3" />
              <circle cx="15" cy="8" r="3" />
              <path d="M3 20c0-3 2.7-5 6-5h6c3.3 0 6 2 6 5" />
            </svg>
            Merge attendees
          </button>

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
                  className={`rounded-xl px-4 py-3 shadow-sm ring-1 ${
                    isAssigned ? 'bg-white ring-zinc-200' : 'bg-amber-50 ring-amber-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-900">{item.description}</p>
                      {isAssigned ? (
                        <p className="mt-0.5 truncate text-xs text-zinc-400">
                          {assigned
                            .map(id => attendees.find(a => a.id === id)?.display_name ?? '?')
                            .join(', ')}
                          {assigned.length > 1 && ` · ${fmt(perPerson!)} each`}
                        </p>
                      ) : (
                        <p className="mt-0.5 text-xs text-amber-600">Unassigned</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-sm font-semibold text-zinc-900">{fmt(item.price)}</span>
                      <button
                        type="button"
                        onClick={() => openAssignModal(item.id)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                          isAssigned
                            ? 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                            : 'bg-amber-500 text-white hover:bg-amber-600'
                        }`}
                      >
                        {isAssigned ? 'Edit' : 'Assign'}
                      </button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </main>

      {/* Summary bar */}
      <div className="fixed inset-x-0 bottom-16 border-t border-zinc-200 bg-white px-4 py-2.5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-zinc-500">
            Assigned: <span className="font-semibold text-zinc-900">{fmt(totalAssigned)}</span>
          </span>
          {split.total != null && (
            <span className="text-zinc-500">
              Total: <span className="font-semibold text-zinc-900">{fmt(split.total)}</span>
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
            {/* Header */}
            <div className="shrink-0 border-b border-zinc-100 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Assign item</p>
              <p className="mt-1 truncate text-sm font-semibold text-zinc-900">{assignModalItem.description}</p>
              <p className="text-sm text-zinc-500">{fmt(assignModalItem.price)}</p>
            </div>
            {/* Scrollable attendee list */}
            <div className="flex-1 overflow-y-auto">
              <button
                type="button"
                onClick={toggleAssignAll}
                className="flex w-full items-center gap-3 border-b border-zinc-100 px-4 py-3 hover:bg-zinc-50"
              >
                <Checkbox checked={attendees.length > 0 && attendees.every(a => assignSelected.includes(a.id))} />
                <p className="text-sm font-medium text-zinc-500">Select all</p>
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
                    className="flex w-full items-center gap-3 px-4 py-3 hover:bg-zinc-50"
                  >
                    <Checkbox checked={sel} />
                    <div className="min-w-0 flex-1 text-left">
                      <p className="truncate text-sm font-medium text-zinc-900">{a.display_name}</p>
                      {share && <p className="text-xs text-zinc-400">{share} each</p>}
                    </div>
                  </button>
                )
              })}
            </div>
            {/* Sticky Save */}
            <div className="shrink-0 border-t border-zinc-100 bg-white px-4 py-4">
              <button
                type="button"
                onClick={handleConfirmAssign}
                disabled={assignSelected.length === 0}
                className="w-full rounded-2xl bg-zinc-900 py-3 text-sm font-semibold text-white disabled:opacity-40"
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
            {/* Header */}
            <div className="shrink-0 border-b border-zinc-100 px-4 py-4">
              <p className="text-sm font-semibold text-zinc-900">Assign by line</p>
              <p className="mt-0.5 text-xs text-zinc-400">Expand each item to assign it. All matching rows are updated at once.</p>
            </div>

            {/* Scrollable item groups */}
            <div className="flex-1 overflow-y-auto">
              {Object.entries(lineGroups).map(([desc, g]) => {
                const group = itemsByDescription[desc] ?? []
                const total = group.reduce((s, i) => s + i.price, 0)
                const selCount = g.combineUnits
                  ? g.sharedAttendees.length
                  : Object.values(g.unitAssignments).filter(Boolean).length
                const allSharedSelected = attendees.length > 0 && attendees.every(a => g.sharedAttendees.includes(a.id))

                return (
                  <div key={desc} className="border-b border-zinc-100 last:border-0">
                    {/* Collapsed row / expand trigger */}
                    <button
                      type="button"
                      onClick={() => toggleGroupExpanded(desc)}
                      className="flex w-full items-center gap-3 px-4 py-3.5 hover:bg-zinc-50"
                    >
                      <div className="min-w-0 flex-1 text-left">
                        <p className="truncate text-sm font-semibold text-zinc-900">{desc}</p>
                        <p className="text-xs text-zinc-400">
                          {group.length > 1 ? `${group.length}× · ` : ''}{fmt(total)}
                          {selCount > 0 && (
                            <span className="ml-1.5 font-medium text-zinc-600">
                              · {g.combineUnits
                                  ? `${selCount === attendees.length ? 'All' : selCount} selected`
                                  : `${selCount} of ${group.length} assigned`}
                            </span>
                          )}
                        </p>
                      </div>
                      <ChevronDown open={g.expanded} />
                    </button>

                    {/* Expanded content */}
                    {g.expanded && (
                      <div className="border-t border-zinc-100 bg-zinc-50/50 pb-2">
                        {/* Combine units toggle */}
                        {group.length > 1 && (
                          <div className="flex items-center justify-between px-4 py-3">
                            <div>
                              <p className="text-sm font-medium text-zinc-900">Combine units</p>
                              <p className="text-xs text-zinc-400">
                                {g.combineUnits
                                  ? 'Cost shared equally among selected people'
                                  : 'Each unit assigned to a different person'}
                              </p>
                            </div>
                            <Toggle checked={g.combineUnits} onChange={() => toggleCombineUnits(desc)} />
                          </div>
                        )}

                        {g.combineUnits ? (
                          /* Shared attendee checklist */
                          <div className="mt-1">
                            <button
                              type="button"
                              onClick={() => toggleSharedAll(desc)}
                              className="flex w-full items-center gap-3 px-4 py-2.5 hover:bg-zinc-100"
                            >
                              <Checkbox checked={allSharedSelected} />
                              <p className="text-sm text-zinc-500">Select all</p>
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
                                  className="flex w-full items-center gap-3 px-4 py-2.5 hover:bg-zinc-100"
                                >
                                  <Checkbox checked={sel} />
                                  <div className="min-w-0 flex-1 text-left">
                                    <p className="truncate text-sm font-medium text-zinc-900">{a.display_name}</p>
                                    {share && <p className="text-xs text-zinc-400">{share} each</p>}
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                        ) : (
                          /* Per-unit selectors */
                          <div className="mt-1 space-y-1 px-4 pb-1">
                            {group.map((item, idx) => (
                              <div key={item.id} className="flex items-center gap-3">
                                <p className="w-14 shrink-0 text-xs text-zinc-400">Unit {idx + 1}</p>
                                <select
                                  value={g.unitAssignments[item.id] ?? ''}
                                  onChange={e => setUnitAttendee(desc, item.id, e.target.value)}
                                  className="flex-1 rounded-lg px-2 py-2 text-sm text-zinc-900 shadow-sm ring-1 ring-zinc-300 outline-none focus:ring-2 focus:ring-zinc-900"
                                >
                                  <option value="">Unassigned</option>
                                  {attendees.map(a => (
                                    <option key={a.id} value={a.id}>{a.display_name}</option>
                                  ))}
                                </select>
                                <span className="w-14 shrink-0 text-right text-xs text-zinc-400">{fmt(item.price)}</span>
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

            {/* Sticky Save assignments */}
            <div className="shrink-0 border-t border-zinc-200 bg-white px-4 py-4">
              <button
                type="button"
                onClick={handleConfirmAssignByLine}
                disabled={busy || !lineGroupsHaveSelection}
                className="w-full rounded-2xl bg-zinc-900 py-3.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                {busy ? 'Saving…' : 'Save assignments'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Merge modal ─────────────────────────────────────────────────────── */}
      {showMerge && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="fixed inset-0 bg-black/40" onClick={() => setShowMerge(false)} />
          <div className="relative w-full rounded-t-2xl bg-white shadow-xl">
            <div className="border-b border-zinc-100 px-4 py-4">
              <p className="text-sm font-semibold text-zinc-900">Merge attendees</p>
              <p className="mt-0.5 text-xs text-zinc-400">Select two or more people to combine into a group.</p>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {attendees.map(a => {
                const sel = mergeSelected.includes(a.id)
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggleMergeSelect(a.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 hover:bg-zinc-50"
                  >
                    <Checkbox checked={sel} />
                    <p className="truncate text-sm font-medium text-zinc-900">{a.display_name}</p>
                  </button>
                )
              })}
            </div>
            <div className="space-y-3 border-t border-zinc-100 px-4 py-4">
              <input
                type="text"
                placeholder="Group label (e.g. Sam & Alex)"
                value={mergeLabel}
                onChange={e => setMergeLabel(e.target.value)}
                className="w-full rounded-lg px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 shadow-sm ring-1 ring-zinc-300 outline-none focus:ring-2 focus:ring-zinc-900"
              />
              <button
                type="button"
                onClick={handleConfirmMerge}
                disabled={mergeSelected.length < 2 || !mergeLabel.trim() || busy}
                className="w-full rounded-2xl bg-zinc-900 py-3 text-sm font-semibold text-white disabled:opacity-40"
              >
                Merge
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
