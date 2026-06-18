'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Tables, SplitStatus } from '@/types/database'
import { deleteSplit } from './splits/actions'

type SplitWithCount = Tables<'splits'> & { attendees: [{ count: number }] | [] }

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso))
}

const STATUS_STYLES: Record<SplitStatus, { label: string; cls: string }> = {
  pending:   { label: 'Pending',   cls: 'bg-amber-50 text-amber-700' },
  draft:     { label: 'Draft',     cls: 'bg-zinc-100 text-zinc-500' },
  finalised: { label: 'Finalised', cls: 'bg-green-50 text-green-700' },
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

  return (
    <div className="relative">
      <Link
        href={`/splits/${split.id}`}
        className="block rounded-2xl bg-white px-4 py-4 shadow-sm ring-1 ring-zinc-200 active:bg-zinc-50"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 pr-8">
            <p className="truncate text-base font-semibold text-zinc-900">{split.title}</p>
            <p className="mt-0.5 text-xs text-zinc-400">
              {formatDate(split.created_at)}
              {count > 0 && ` · ${count} ${count === 1 ? 'person' : 'people'}`}
            </p>
          </div>
          <StatusBadge status={split.status} />
        </div>
      </Link>

      {/* Delete controls — float over the card */}
      <div className="absolute right-3 bottom-3 flex items-center gap-1.5">
        {confirming && (
          <>
            <button
              type="button"
              onClick={handleCancelConfirm}
              className="rounded-lg bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-200"
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
            className="rounded-lg p-1.5 text-zinc-300 hover:bg-red-50 hover:text-red-500"
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
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true"
            stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="2" width="14" height="20" rx="2" />
            <path d="M9 7h6M9 11h6M9 15h4" />
          </svg>
        </div>
        <p className="text-base font-semibold text-zinc-900">No splits yet</p>
        <p className="mt-1.5 max-w-xs text-sm text-zinc-400">
          Start by adding a group or a new split.
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
