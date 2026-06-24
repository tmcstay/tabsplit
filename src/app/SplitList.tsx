'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { Tables, SplitStatus } from '@/types/database'
import { deleteSplit } from './splits/actions'

type SplitWithCount = Tables<'splits'> & { attendees: [{ count: number }] | [] }

function ClientDate({ iso }: { iso: string }) {
  const [label, setLabel] = useState<string | null>(null)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLabel(new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso)))
  }, [iso])
  return <>{label}</>
}

const STATUS_STYLES: Record<SplitStatus, { label: string; cls: string }> = {
  pending:   { label: 'Pending',   cls: 'bg-blue-50 text-blue-600' },
  draft:     { label: 'Draft',     cls: 'bg-amber-50 text-amber-700' },
  finalised: { label: 'Finalised', cls: 'bg-green-50 text-green-700' },
}

// Deterministic gradient from split ID
const GRADIENTS = [
  'linear-gradient(135deg, #14b8a6, #3b82f6)',
  'linear-gradient(135deg, #f97316, #ef4444)',
  'linear-gradient(135deg, #8b5cf6, #6366f1)',
  'linear-gradient(135deg, #1caebb, #1079bf)',
]

function getGradient(id: string): string {
  const hash = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return GRADIENTS[hash % GRADIENTS.length]
}

function getSplitIcon(title: string): 'coffee' | 'soup' | 'pizza' | 'cocktail' | 'burger' | 'receipt' {
  const t = title.toLowerCase()
  if (t.includes('coffee') || t.includes('cafe') || t.includes('brunch')) return 'coffee'
  if (t.includes('pizza')) return 'pizza'
  if (t.includes('bar') || t.includes('drink') || t.includes('cocktail') || t.includes('pub')) return 'cocktail'
  if (t.includes('burger')) return 'burger'
  if (t.includes('dinner') || t.includes('lunch') || t.includes('restaurant') || t.includes('food') || t.includes('soup')) return 'soup'
  return 'receipt'
}

function SplitIconSvg({ type }: { type: ReturnType<typeof getSplitIcon> }) {
  const props = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none' as const, stroke: 'white', strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
  if (type === 'coffee') return (
    <svg {...props}>
      <path d="M18 8h1a4 4 0 010 8h-1" />
      <path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z" />
      <line x1="6" y1="1" x2="6" y2="4" />
      <line x1="10" y1="1" x2="10" y2="4" />
      <line x1="14" y1="1" x2="14" y2="4" />
    </svg>
  )
  if (type === 'pizza') return (
    <svg {...props}>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
      <path d="M2 12h20M12 2v20" />
      <circle cx="8" cy="9" r="1.5" fill="white" stroke="none" />
      <circle cx="15" cy="15" r="1.5" fill="white" stroke="none" />
    </svg>
  )
  if (type === 'cocktail') return (
    <svg {...props}>
      <path d="M8 22h8M12 11v11M3 3l9 8 9-8H3z" />
    </svg>
  )
  if (type === 'burger') return (
    <svg {...props}>
      <path d="M4 13h16M4 17h16M6 9c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <rect x="3" y="17" width="18" height="4" rx="1" />
    </svg>
  )
  if (type === 'soup') return (
    <svg {...props}>
      <path d="M12 21a9 9 0 100-18 9 9 0 000 18z" />
      <path d="M4.22 15h15.56M8 11h.01M12 9h.01M16 11h.01" />
    </svg>
  )
  // receipt (default)
  return (
    <svg {...props}>
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <path d="M9 7h6M9 11h6M9 15h4" />
    </svg>
  )
}

function StatusBadge({ status }: { status: SplitStatus }) {
  const { label, cls } = STATUS_STYLES[status]
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  )
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"
      stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
    </svg>
  )
}

function SplitItem({ split, onDelete }: { split: SplitWithCount; onDelete: (id: string) => void }) {
  const count = split.attendees[0]?.count ?? 0
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirming) {
      setConfirming(true)
      return
    }
    setDeleting(true)
    try {
      await deleteSplit(split.id)
      onDelete(split.id)
    } catch {
      setDeleting(false)
      setConfirming(false)
    }
  }

  function handleCancelConfirm(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setConfirming(false)
  }

  const iconType = getSplitIcon(split.title)
  const gradient = getGradient(split.id)

  return (
    <div className="relative">
      <Link
        href={`/splits/${split.id}`}
        className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3.5 shadow-sm ring-1 ring-slate-200 active:bg-slate-50"
      >
        {/* Gradient icon tile */}
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: gradient }}
        >
          <SplitIconSvg type={iconType} />
        </div>

        {/* Text content */}
        <div className="min-w-0 flex-1 pr-16">
          <p className="truncate text-sm font-semibold text-gwfc-blue">{split.title}</p>
          <p className="mt-0.5 text-xs text-slate-400">
            <ClientDate iso={split.created_at} />
            {count > 0 && ` · ${count} ${count === 1 ? 'person' : 'people'}`}
          </p>
        </div>

        {/* Status pill */}
        <div className="shrink-0">
          <StatusBadge status={split.status} />
        </div>
      </Link>

      {/* Delete controls */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
        {confirming && (
          <>
            <button
              type="button"
              onClick={handleCancelConfirm}
              className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-lg bg-red-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50"
            >
              {deleting ? 'Deleting…' : 'Confirm'}
            </button>
          </>
        )}
        {!confirming && (
          <button
            type="button"
            onClick={handleDelete}
            className="rounded-lg p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500"
            aria-label={`Delete ${split.title}`}
          >
            <TrashIcon />
          </button>
        )}
      </div>
    </div>
  )
}

export function SplitList({ initialSplits }: { initialSplits: SplitWithCount[] }) {
  const [splits, setSplits] = useState(initialSplits)

  function handleDelete(id: string) {
    setSplits(prev => prev.filter(s => s.id !== id))
  }

  if (splits.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true"
            stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="2" width="14" height="20" rx="2" />
            <path d="M9 7h6M9 11h6M9 15h4" />
          </svg>
        </div>
        <p className="text-base font-semibold text-gwfc-blue">No splits yet</p>
        <p className="mt-1.5 max-w-xs text-sm text-slate-400">
          Tap the + button to get started.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {splits.map(split => (
        <SplitItem key={split.id} split={split} onDelete={handleDelete} />
      ))}
    </div>
  )
}
