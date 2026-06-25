'use client'

import { useState } from 'react'

export interface PersonResult {
  id: string
  label: string
  total: number
  itemLines: { description: string; share: number }[]
  discountLines: { description: string; amount: number }[]
  paid: boolean
  isGroup: boolean
  phone: string | null
  email: string | null
}

interface PersonCardProps {
  person: PersonResult
  splitTitle: string
  shareUrl: string | null
  onTogglePaid: (entityId: string, paid: boolean, isGroup: boolean) => void
}

export function PersonCard({ person, splitTitle, shareUrl, onTogglePaid }: PersonCardProps) {
  const [open, setOpen] = useState(false)
  const hasDetails = person.itemLines.length > 0 || person.discountLines.length > 0

  function handleShare(e: React.MouseEvent) {
    e.stopPropagation()
    if (!shareUrl) return
    const message = `Hey ${person.label}, here's the TabSplit for ${splitTitle} — you owe $${person.total.toFixed(2)}. ${shareUrl}`
    if (navigator.share) {
      navigator.share({ text: message }).catch(() => {})
    } else {
      navigator.clipboard.writeText(message).catch(() => {})
    }
  }

  function handleTogglePaid(e: React.MouseEvent) {
    e.stopPropagation()
    onTogglePaid(person.id, !person.paid, person.isGroup)
  }

  return (
    <div className={`overflow-hidden rounded-2xl bg-white shadow-sm ring-1 transition-colors ${
      person.paid ? 'ring-emerald-200' : 'ring-slate-200'
    }`}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between px-4 py-4 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-gwfc-blue">{person.label}</p>
            {person.paid && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                Paid
              </span>
            )}
          </div>
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
          <p className={`text-xl font-bold ${person.paid ? 'text-emerald-600' : 'text-gwfc-blue'}`}>
            ${person.total.toFixed(2)}
          </p>
          <svg
            width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"
            stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
            className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100">
          {hasDetails && (
            <>
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
            </>
          )}

          {/* Action row */}
          <div className="flex gap-2 border-t border-slate-100 px-4 py-3">
            <button
              type="button"
              onClick={handleTogglePaid}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-medium transition-colors ${
                person.paid
                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {person.paid ? (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  Paid
                </>
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4M12 16h.01" />
                  </svg>
                  Mark paid
                </>
              )}
            </button>

            {shareUrl && (
              <button
                type="button"
                onClick={handleShare}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-100 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />
                </svg>
                Resend
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
