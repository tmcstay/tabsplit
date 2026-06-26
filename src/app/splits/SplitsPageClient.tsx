'use client'

import { useState } from 'react'
import { SplitList } from '../SplitList'
import type { Tables, SplitStatus } from '@/types/database'

export type SplitWithPaid = Tables<'splits'> & { attendees: { paid: boolean }[] }

type Tab = 'active' | 'complete' | 'archived'

interface Props {
  splits: SplitWithPaid[]
}

export function SplitsPageClient({ splits: initialSplits }: Props) {
  const [splits, setSplits] = useState<SplitWithPaid[]>(initialSplits)
  const [tab, setTab] = useState<Tab>('active')

  const allPaid = (s: SplitWithPaid) =>
    s.attendees.length > 0 && s.attendees.every(a => a.paid)

  const activeSplits = splits.filter(
    s => s.status === 'pending' || s.status === 'draft' || (s.status === 'finalised' && !allPaid(s))
  )
  const completeSplits = splits.filter(s => s.status === 'finalised' && allPaid(s))
  const archivedSplits = splits.filter(s => s.status === 'archived')

  function handleArchive(id: string) {
    setSplits(prev => prev.map(s => s.id === id ? { ...s, status: 'archived' as SplitStatus } : s))
  }

  function handleRestore(id: string, newStatus: SplitStatus) {
    setSplits(prev => prev.map(s => s.id === id ? { ...s, status: newStatus } : s))
  }

  function handleDelete(id: string) {
    setSplits(prev => prev.filter(s => s.id !== id))
  }

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'active', label: 'Active', count: activeSplits.length },
    { id: 'complete', label: 'Complete', count: completeSplits.length },
    { id: 'archived', label: 'Archived', count: archivedSplits.length },
  ]

  return (
    <main className="flex-1 px-4 py-5">
      {/* Tab switcher */}
      <div className="mb-5 flex rounded-xl bg-slate-100 p-1">
        {tabs.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-colors ${
              tab === t.id ? 'bg-white text-gwfc-blue shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                tab === t.id ? 'bg-slate-100 text-slate-500' : 'bg-slate-200 text-slate-400'
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content — all rendered but hidden to preserve swipe state */}
      <div className={tab !== 'active' ? 'hidden' : ''}>
        <SplitList splits={activeSplits} onArchive={handleArchive} onRestore={handleRestore} onDelete={handleDelete} />
      </div>
      <div className={tab !== 'complete' ? 'hidden' : ''}>
        <SplitList splits={completeSplits} onArchive={handleArchive} onRestore={handleRestore} onDelete={handleDelete} />
      </div>
      <div className={tab !== 'archived' ? 'hidden' : ''}>
        <SplitList splits={archivedSplits} onArchive={handleArchive} onRestore={handleRestore} onDelete={handleDelete} />
      </div>
    </main>
  )
}
