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

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
      checked ? 'border-zinc-900 bg-zinc-900' : 'border-zinc-300 bg-white'
    }`}>
      {checked && <CheckIcon />}
    </span>
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
  const [scanning, setScanning] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sync state when props change after router.refresh()
  useEffect(() => {
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

  function openAssignModal(itemId: string) {
    setAssignModalItemId(itemId)
    setAssignSelected(assignments[itemId] ?? [])
  }

  function toggleAssignSelect(id: string) {
    setAssignSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
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

  // ── No items yet ────────────────────────────────────────────────────────────

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
        </main>
      </>
    )
  }

  // ── Item assignment UI ───────────────────────────────────────────────────────

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

      <main className="flex-1 space-y-4 px-4 py-4 pb-28">
        {/* Receipt thumbnail */}
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

        {/* Merge button */}
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

        {/* Items */}
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setShowReceiptFull(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={signedReceiptUrl} alt="Receipt" className="max-h-full max-w-full rounded-xl object-contain" />
        </div>
      )}

      {/* Assign bottom sheet */}
      {assignModalItemId && assignModalItem && (
        <div className="fixed inset-0 z-40 flex items-end">
          <div className="fixed inset-0 bg-black/40" onClick={() => setAssignModalItemId(null)} />
          <div className="relative w-full rounded-t-2xl bg-white shadow-xl">
            <div className="border-b border-zinc-100 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Assign item</p>
              <p className="mt-1 truncate text-sm font-semibold text-zinc-900">{assignModalItem.description}</p>
              <p className="text-sm text-zinc-500">{fmt(assignModalItem.price)}</p>
            </div>
            <div className="max-h-64 overflow-y-auto">
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
                      {share && <p className="text-xs text-zinc-400">{share}</p>}
                    </div>
                  </button>
                )
              })}
            </div>
            <div className="border-t border-zinc-100 px-4 py-4">
              <button
                type="button"
                onClick={handleConfirmAssign}
                disabled={assignSelected.length === 0}
                className="w-full rounded-2xl bg-zinc-900 py-3 text-sm font-semibold text-white disabled:opacity-40"
              >
                {assignSelected.length === 0
                  ? 'Select people'
                  : `Assign to ${assignSelected.length} ${assignSelected.length === 1 ? 'person' : 'people'}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Merge modal */}
      {showMerge && (
        <div className="fixed inset-0 z-40 flex items-end">
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
