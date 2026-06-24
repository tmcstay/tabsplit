'use client'

import { useState } from 'react'

export interface PersonResult {
  id: string
  label: string
  total: number
  itemLines: { description: string; share: number }[]
  discountLines: { description: string; amount: number }[]
}

export function PersonCard({ person }: { person: PersonResult }) {
  const [open, setOpen] = useState(false)
  const hasDetails = person.itemLines.length > 0 || person.discountLines.length > 0

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between px-4 py-4 text-left"
      >
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
        <div className="flex shrink-0 items-center gap-2">
          <p className="text-xl font-bold text-gwfc-blue">${person.total.toFixed(2)}</p>
          <svg
            width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"
            stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
            className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </button>

      {open && hasDetails && (
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
  )
}
