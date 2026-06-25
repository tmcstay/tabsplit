'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Tables, SplitStatus } from '@/types/database'
import { archiveSplit, deleteSplit } from './splits/actions'

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
  archived:  { label: 'Archived',  cls: 'bg-slate-100 text-slate-500' },
}

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

const ACTION_WIDTH = 160 // 80px × 2 buttons

function SplitItem({
  split,
  onArchive,
  onDelete,
  isOpen,
  onOpen,
  onClose,
}: {
  split: SplitWithCount
  onArchive: (id: string) => void
  onDelete: (id: string) => void
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
}) {
  const router = useRouter()
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [transitioning, setTransitioning] = useState(false)
  const [busy, setBusy] = useState<'archive' | 'delete' | null>(null)
  const startXRef = useRef(0)
  const startOffsetRef = useRef(0)
  const didMoveRef = useRef(false)

  // Snap back when another card opens
  useEffect(() => {
    if (!isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTransitioning(true)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSwipeOffset(0)
    }
  }, [isOpen])

  function handleTouchStart(e: React.TouchEvent) {
    startXRef.current = e.touches[0].clientX
    startOffsetRef.current = swipeOffset
    didMoveRef.current = false
    setTransitioning(false)
  }

  function handleTouchMove(e: React.TouchEvent) {
    const deltaX = e.touches[0].clientX - startXRef.current
    if (Math.abs(deltaX) > 5) didMoveRef.current = true
    const newOffset = Math.min(0, Math.max(-ACTION_WIDTH, startOffsetRef.current + deltaX))
    setSwipeOffset(newOffset)
  }

  function handleTouchEnd() {
    setTransitioning(true)
    if (swipeOffset < -(ACTION_WIDTH / 2)) {
      setSwipeOffset(-ACTION_WIDTH)
      onOpen()
    } else {
      setSwipeOffset(0)
      onClose()
    }
  }

  function handleClick() {
    if (didMoveRef.current) return
    if (isOpen) {
      setTransitioning(true)
      setSwipeOffset(0)
      onClose()
      return
    }
    router.push(`/splits/${split.id}`)
  }

  async function handleArchive(e: React.MouseEvent) {
    e.stopPropagation()
    setBusy('archive')
    try {
      await archiveSplit(split.id)
      onArchive(split.id)
    } catch {
      setBusy(null)
      setTransitioning(true)
      setSwipeOffset(0)
      onClose()
    }
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    setBusy('delete')
    try {
      await deleteSplit(split.id)
      onDelete(split.id)
    } catch {
      setBusy(null)
      setTransitioning(true)
      setSwipeOffset(0)
      onClose()
    }
  }

  const count = split.attendees[0]?.count ?? 0
  const iconType = getSplitIcon(split.title)
  const gradient = getGradient(split.id)
  const isArchived = split.status === 'archived'

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Action buttons revealed behind the card */}
      <div className="absolute inset-y-0 right-0 flex" style={{ width: ACTION_WIDTH }}>
        {/* Archive */}
        <button
          type="button"
          onClick={handleArchive}
          disabled={!!busy || isArchived}
          className="flex w-20 flex-col items-center justify-center gap-0.5 bg-slate-500 text-white disabled:opacity-50"
          aria-label={isArchived ? 'Already archived' : 'Archive split'}
        >
          {busy === 'archive' ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="animate-spin">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="21 8 21 21 3 21 3 8" />
              <rect x="1" y="3" width="22" height="5" />
              <line x1="10" y1="12" x2="14" y2="12" />
            </svg>
          )}
          <span className="text-xs font-semibold">{busy === 'archive' ? '…' : isArchived ? 'Archived' : 'Archive'}</span>
        </button>

        {/* Delete */}
        <button
          type="button"
          onClick={handleDelete}
          disabled={!!busy}
          className="flex w-20 flex-col items-center justify-center gap-0.5 bg-red-500 text-white disabled:opacity-50"
          aria-label="Delete split"
        >
          {busy === 'delete' ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="animate-spin">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
            </svg>
          )}
          <span className="text-xs font-semibold">{busy === 'delete' ? '…' : 'Delete'}</span>
        </button>
      </div>

      {/* Swipeable card */}
      <div
        className="relative rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 active:bg-slate-50 cursor-pointer select-none"
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: transitioning ? 'transform 0.2s ease-out' : 'none',
          touchAction: 'pan-y',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && handleClick()}
      >
        <div className="flex items-center gap-3 px-4 py-3.5">
          {/* Gradient icon tile */}
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isArchived ? 'opacity-50' : ''}`}
            style={{ background: gradient }}
          >
            <SplitIconSvg type={iconType} />
          </div>

          {/* Text content */}
          <div className="min-w-0 flex-1">
            <p className={`truncate text-sm font-semibold ${isArchived ? 'text-slate-400' : 'text-gwfc-blue'}`}>
              {split.title}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              <ClientDate iso={split.created_at} />
              {count > 0 && ` · ${count} ${count === 1 ? 'person' : 'people'}`}
            </p>
          </div>

          {/* Status badge */}
          <div className="shrink-0">
            <StatusBadge status={split.status} />
          </div>
        </div>
      </div>
    </div>
  )
}

export function SplitList({ initialSplits }: { initialSplits: SplitWithCount[] }) {
  const [splits, setSplits] = useState(initialSplits)
  const [openId, setOpenId] = useState<string | null>(null)

  function handleArchive(id: string) {
    setSplits(prev => prev.map(s => s.id === id ? { ...s, status: 'archived' as const } : s))
    setOpenId(null)
  }

  function handleDelete(id: string) {
    setSplits(prev => prev.filter(s => s.id !== id))
    setOpenId(null)
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
        <SplitItem
          key={split.id}
          split={split}
          onArchive={handleArchive}
          onDelete={handleDelete}
          isOpen={openId === split.id}
          onOpen={() => setOpenId(split.id)}
          onClose={() => { if (openId === split.id) setOpenId(null) }}
        />
      ))}
    </div>
  )
}
