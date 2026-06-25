'use client'

import { useState } from 'react'

export interface GroupMember {
  display_name: string
  phone: string | null
  email: string | null
}

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
  groupMembers: GroupMember[]
  isFavourite: boolean
  favouriteId: string | null
}

interface PersonCardProps {
  person: PersonResult
  splitTitle: string
  shareUrl: string | null
  onTogglePaid: (entityId: string, paid: boolean, isGroup: boolean) => void
  onToggleFavourite: (person: PersonResult) => void
}

export function PersonCard({ person, splitTitle, shareUrl, onTogglePaid, onToggleFavourite }: PersonCardProps) {
  const [open, setOpen] = useState(false)
  const [showGroupSharePicker, setShowGroupSharePicker] = useState(false)
  const hasDetails = person.itemLines.length > 0 || person.discountLines.length > 0

  const shareableGroupMembers = person.groupMembers.filter(m => m.phone || m.email)

  function sendShare() {
    if (!shareUrl) return
    const message = `Hey ${person.label}, here's the TabSplit for ${splitTitle} — your group owes $${person.total.toFixed(2)}. ${shareUrl}`
    if (navigator.share) {
      navigator.share({ text: message }).catch(() => {})
    } else {
      navigator.clipboard.writeText(message).catch(() => {})
    }
  }

  function handleShare(e: React.MouseEvent) {
    e.stopPropagation()
    if (!shareUrl) return
    if (person.isGroup && shareableGroupMembers.length > 0) {
      setShowGroupSharePicker(true)
      return
    }
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

  function handleToggleFavourite(e: React.MouseEvent) {
    e.stopPropagation()
    onToggleFavourite(person)
  }

  return (
    <>
      {/* Group share picker sheet */}
      {showGroupSharePicker && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="fixed inset-0 bg-black/40" onClick={() => setShowGroupSharePicker(false)} />
          <div className="relative w-full rounded-t-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4">
              <p className="text-sm font-semibold text-gwfc-blue">Send to</p>
              <button type="button" onClick={() => setShowGroupSharePicker(false)}
                className="text-slate-400 hover:text-slate-600" aria-label="Close">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            {shareableGroupMembers.map((m, i) => (
              <button
                key={i}
                type="button"
                onClick={() => { sendShare(); setShowGroupSharePicker(false) }}
                className="flex w-full items-center justify-between border-b border-slate-100 px-4 py-3.5 last:border-0 hover:bg-slate-50 active:bg-slate-100"
              >
                <div className="text-left">
                  <p className="text-sm font-medium text-gwfc-blue">{m.display_name}</p>
                  <p className="text-xs text-slate-400">{m.phone ?? m.email}</p>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                  <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={`overflow-hidden rounded-2xl bg-white shadow-sm ring-1 transition-colors ${
        person.paid ? 'ring-emerald-200' : 'ring-slate-200'
      }`}>
        {/* Header row */}
        <div className="flex items-center">
          {/* Paid circle — left */}
          <button
            type="button"
            onClick={handleTogglePaid}
            className="shrink-0 py-4 pl-4 pr-2"
            aria-label={person.paid ? 'Mark unpaid' : 'Mark paid'}
          >
            <span className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors ${
              person.paid
                ? 'border-emerald-500 bg-emerald-500 text-white'
                : 'border-slate-300 bg-white'
            }`}>
              {person.paid && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              )}
            </span>
          </button>

          {/* Expand tap area — flex-1 */}
          <button
            type="button"
            onClick={() => setOpen(v => !v)}
            className="flex flex-1 items-center justify-between py-4 pr-2 text-left"
          >
            <div className="min-w-0">
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
            <div className="flex shrink-0 items-center gap-1.5">
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

          {/* Star button — right, only for individuals */}
          {!person.isGroup && (
            <button
              type="button"
              onClick={handleToggleFavourite}
              className={`shrink-0 py-4 pl-1 pr-4 transition-colors ${
                person.isFavourite ? 'text-amber-400' : 'text-slate-300 hover:text-amber-300'
              }`}
              aria-label={person.isFavourite ? 'Remove from favourites' : 'Add to favourites'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24"
                fill={person.isFavourite ? 'currentColor' : 'none'}
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </button>
          )}
        </div>

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
    </>
  )
}
