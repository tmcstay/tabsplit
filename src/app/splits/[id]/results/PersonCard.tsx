'use client'

import { useState } from 'react'
import { shareText } from '@/lib/share'

export interface PersonResult {
  id: string
  label: string
  total: number
  itemLines: { description: string; share: number }[]
  discountLines: { description: string; amount: number }[]
  isOrganiser?: boolean
}

interface Props {
  person: PersonResult
  shareToken?: string
  splitTitle?: string
}

export function PersonCard({ person, shareToken, splitTitle }: Props) {
  const [open, setOpen] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const hasDetails = person.itemLines.length > 0 || person.discountLines.length > 0
  const showShareBtn = !person.isOrganiser && !!shareToken && !!splitTitle

  async function handlePersonShare() {
    if (!shareToken || !splitTitle) return
    const url = `${window.location.origin}/share/${shareToken}`
    const firstName = person.label.split(' ')[0]
    const result = await shareText({
      title: splitTitle,
      text: `Hey ${firstName}, here's your share of ${splitTitle}: $${person.total.toFixed(2)}. View the full breakdown:`,
      url,
    })
    if (result === 'copied') {
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2500)
    }
  }

  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
      <div className="flex items-stretch">
        {/* Expand / collapse toggle */}
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="flex flex-1 items-center justify-between px-4 py-4 text-left"
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
          <div className="flex shrink-0 items-center gap-2 pl-2">
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

        {/* Per-person share button */}
        {showShareBtn && (
          <button
            type="button"
            onClick={handlePersonShare}
            title={shareCopied ? 'Link copied!' : `Share ${person.label}'s total`}
            aria-label={shareCopied ? 'Link copied!' : `Share ${person.label}'s total`}
            className="flex h-full w-12 shrink-0 items-center justify-center border-l border-slate-100 text-gwfc-light-blue hover:bg-slate-50 active:bg-slate-100"
          >
            {shareCopied ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                className="text-emerald-500">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"
                stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" fill="currentColor" stroke="none" />
              </svg>
            )}
          </button>
        )}
      </div>

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
