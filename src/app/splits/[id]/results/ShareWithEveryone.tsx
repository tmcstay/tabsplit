'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { shareText } from '@/lib/share'

export interface ModalAttendee {
  id: string
  display_name: string
  phone: string | null
  email: string | null
  total: number
}

type Method = 'link' | 'email' | 'sms'

interface Props {
  splitTitle: string
  shareToken: string
  attendees: ModalAttendee[]
  organiserPayid?: string | null
  organiserPayidLabel?: string | null
}

export function ShareWithEveryone({
  splitTitle,
  shareToken,
  attendees,
  organiserPayid,
  organiserPayidLabel,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [method, setMethod] = useState<Method>('link')

  function openModal() {
    // DEBUG — remove once phone flow confirmed working
    console.log('[ShareWithEveryone] attendees on open:', attendees.map(a => ({
      name: a.display_name,
      phone: a.phone,
      email: a.email,
      total: a.total,
    })))
    setOpen(true)
  }
  const [sentIds, setSentIds] = useState<Set<string>>(new Set())
  const [payidCopied, setPayidCopied] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  async function copyPayid() {
    if (!organiserPayid) return
    await navigator.clipboard.writeText(organiserPayid)
    setPayidCopied(true)
    setTimeout(() => setPayidCopied(false), 2500)
  }

  function buildMessage(attendee: ModalAttendee): string {
    const firstName = attendee.display_name.split(' ')[0]
    let msg = `Hey ${firstName}, here's your share of ${splitTitle}: $${attendee.total.toFixed(2)}.`
    if (organiserPayid) {
      msg += `\nPay via ${organiserPayidLabel ?? 'PayID'}: ${organiserPayid}`
    }
    return msg
  }

  async function handleSend(attendee: ModalAttendee) {
    const url = `${window.location.origin}/share/${shareToken}`
    const message = buildMessage(attendee)
    const firstName = attendee.display_name.split(' ')[0]

    if (method === 'sms' && attendee.phone) {
      const encoded = encodeURIComponent(`${message}\n\nView full breakdown: ${url}`)
      window.location.assign(`sms:${attendee.phone}?body=${encoded}`)
      setSentIds(prev => new Set([...prev, attendee.id]))
    } else if (method === 'email' && attendee.email) {
      const subject = encodeURIComponent(`${splitTitle} split`)
      const body = encodeURIComponent(`${message}\n\nView full breakdown: ${url}`)
      window.location.assign(`mailto:${attendee.email}?subject=${subject}&body=${body}`)
      setSentIds(prev => new Set([...prev, attendee.id]))
    } else {
      const result = await shareText({ title: splitTitle, text: message, url })
      if (result === 'shared') {
        setSentIds(prev => new Set([...prev, attendee.id]))
      } else if (result === 'copied') {
        setSentIds(prev => new Set([...prev, attendee.id]))
        setToast(`Copied ${firstName}'s message — paste it into your messaging app`)
        setTimeout(() => setToast(null), 4000)
      }
      // 'dismissed' = user cancelled share sheet — do not mark as sent
    }
  }

  function resetAndClose() {
    setOpen(false)
    setSentIds(new Set())
    setToast(null)
  }

  const methodHint =
    method === 'sms'
      ? 'Opens Messages or SMS app'
      : method === 'email'
      ? 'Opens your email app'
      : 'Uses share sheet or copies to clipboard'

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={openModal}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gwfc-green py-3.5 text-sm font-semibold text-white active:opacity-90"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" fill="currentColor" stroke="none" />
        </svg>
        Share with everyone
      </button>

      {/* Bottom sheet modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="fixed inset-0 bg-black/40" onClick={resetAndClose} />
          <div className="relative flex max-h-[90vh] w-full flex-col rounded-t-2xl bg-white shadow-xl">

            {/* Header */}
            <div className="shrink-0 border-b border-slate-100 px-4 pt-4 pb-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gwfc-blue">Send to attendees</p>
                <button
                  type="button"
                  onClick={resetAndClose}
                  className="text-slate-400 hover:text-slate-600"
                  aria-label="Close"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* PayID section */}
              {organiserPayid ? (
                <button
                  type="button"
                  onClick={copyPayid}
                  className="mt-3 flex w-full items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200"
                >
                  <div className="text-left">
                    <p className="text-xs text-slate-400">{organiserPayidLabel ?? 'PayID'}</p>
                    <p className="text-sm font-semibold text-gwfc-blue">{organiserPayid}</p>
                  </div>
                  <span className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                    payidCopied ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {payidCopied ? 'Copied!' : 'Copy'}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => { resetAndClose(); router.push('/profile') }}
                  className="mt-3 flex w-full items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200"
                >
                  <p className="text-xs text-slate-400">Add your PayID so people know where to pay</p>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"
                    stroke="#94a3b8" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              )}

              {/* Method selector */}
              <div className="mt-3 flex gap-1 rounded-xl bg-slate-100 p-1">
                {(['link', 'email', 'sms'] as Method[]).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethod(m)}
                    className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-colors ${
                      method === m ? 'bg-gwfc-green text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {m === 'link' ? 'Link' : m === 'email' ? 'Email' : 'SMS'}
                  </button>
                ))}
              </div>
            </div>

            {/* Attendee list */}
            <div className="flex-1 overflow-y-auto">
              {attendees.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-slate-400">No other attendees.</p>
              ) : (
                attendees.map(attendee => {
                  const sent = sentIds.has(attendee.id)
                  const disabled =
                    (method === 'sms' && !attendee.phone) ||
                    (method === 'email' && !attendee.email)

                  return (
                    <div
                      key={attendee.id}
                      className={`flex items-center gap-3 border-b border-slate-100 px-4 py-3.5 last:border-0 transition-opacity ${
                        sent ? 'opacity-50' : ''
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gwfc-blue">{attendee.display_name}</p>
                        <p className="text-xs text-slate-400">${attendee.total.toFixed(2)}</p>
                        {disabled && !sent && (
                          <p className="text-xs text-slate-400">
                            {method === 'sms' ? 'No phone number' : 'No email'}
                          </p>
                        )}
                      </div>

                      {sent ? (
                        <div className="flex shrink-0 items-center gap-1.5 text-xs text-slate-400">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"
                            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                            className="text-emerald-500">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                          Sent
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSend(attendee)}
                          disabled={disabled}
                          className="shrink-0 rounded-xl bg-gwfc-green px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          Send
                        </button>
                      )}
                    </div>
                  )
                })
              )}
            </div>

            {/* Footer hint / toast */}
            <div className="shrink-0 border-t border-slate-100 bg-white px-4 py-3">
              <p className="text-center text-xs text-slate-400">
                {toast ?? methodHint}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
