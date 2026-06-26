'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { shareText } from '@/lib/share'

export interface GroupMember {
  display_name: string
  phone: string | null
  email: string | null
  total: number
}

export interface ModalAttendee {
  id: string
  display_name: string
  phone: string | null
  email: string | null
  total: number
  groupMembers: GroupMember[]
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
  const [sentIds, setSentIds] = useState<Set<string>>(new Set())
  const [payidCopied, setPayidCopied] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [pickerAttendee, setPickerAttendee] = useState<ModalAttendee | null>(null)
  const [pickerSelected, setPickerSelected] = useState<Set<number>>(new Set())

  async function copyPayid() {
    if (!organiserPayid) return
    await navigator.clipboard.writeText(organiserPayid)
    setPayidCopied(true)
    setTimeout(() => setPayidCopied(false), 2500)
  }

  function buildMessage(displayName: string, total: number, isGroup: boolean, memberBreakdown?: GroupMember[]): string {
    const greeting = isGroup ? displayName : displayName.split(' ')[0]
    let msg = `Hey ${greeting}, here's your share of ${splitTitle}: $${total.toFixed(2)}.`
    if (isGroup && memberBreakdown && memberBreakdown.length > 1) {
      for (const m of memberBreakdown) {
        msg += `\n${m.display_name}: $${m.total.toFixed(2)}`
      }
    }
    if (organiserPayid) {
      msg += `\nPay via PayID (${organiserPayidLabel ?? 'Other'}): ${organiserPayid}`
    }
    return msg
  }

  async function doSend(
    displayName: string,
    phones: string[],
    emails: string[],
    total: number,
    markId: string,
    isGroup: boolean,
    memberBreakdown?: GroupMember[]
  ) {
    const url = `${window.location.origin}/share/${shareToken}`
    const message = buildMessage(displayName, total, isGroup, memberBreakdown)

    if (method === 'sms' && phones.length > 0) {
      const encoded = encodeURIComponent(`${message}\n\nView full breakdown: ${url}`)
      window.location.assign(`sms:${phones.join(',')}?body=${encoded}`)
      setSentIds(prev => new Set([...prev, markId]))
    } else if (method === 'email' && emails.length > 0) {
      const subject = encodeURIComponent(`${splitTitle} split`)
      const body = encodeURIComponent(`${message}\n\nView full breakdown: ${url}`)
      window.location.assign(`mailto:${emails.join(',')}?subject=${subject}&body=${body}`)
      setSentIds(prev => new Set([...prev, markId]))
    } else {
      const result = await shareText({ title: splitTitle, text: message, url })
      if (result === 'shared') {
        setSentIds(prev => new Set([...prev, markId]))
      } else if (result === 'copied') {
        setSentIds(prev => new Set([...prev, markId]))
        setToast(`Copied ${displayName}'s message — paste it into your messaging app`)
        setTimeout(() => setToast(null), 4000)
      }
    }
  }

  async function handleSend(attendee: ModalAttendee) {
    const contactableMembers = attendee.groupMembers.filter(m => {
      if (method === 'sms') return !!m.phone
      if (method === 'email') return !!m.email
      return !!(m.phone || m.email)
    })

    // Group with 2+ contactable members — show multi-select picker
    if (attendee.groupMembers.length > 0 && contactableMembers.length > 1) {
      setPickerAttendee(attendee)
      // Pre-select all contactable members
      setPickerSelected(new Set(
        attendee.groupMembers
          .map((m, i) => ({ m, i }))
          .filter(({ m }) => method === 'sms' ? !!m.phone : method === 'email' ? !!m.email : !!(m.phone || m.email))
          .map(({ i }) => i)
      ))
      return
    }

    // Group with exactly one contactable member — send directly using group label
    if (attendee.groupMembers.length > 0 && contactableMembers.length === 1) {
      const m = contactableMembers[0]
      await doSend(
        attendee.display_name,
        m.phone ? [m.phone] : [],
        m.email ? [m.email] : [],
        attendee.total,
        attendee.id,
        true,
        attendee.groupMembers
      )
      return
    }

    // Individual attendee
    await doSend(
      attendee.display_name,
      attendee.phone ? [attendee.phone] : [],
      attendee.email ? [attendee.email] : [],
      attendee.total,
      attendee.id,
      false
    )
  }

  async function handlePickerSend() {
    if (!pickerAttendee) return
    const selected = pickerAttendee.groupMembers.filter((_, i) => pickerSelected.has(i))
    const phones = selected.map(m => m.phone).filter((p): p is string => !!p)
    const emails = selected.map(m => m.email).filter((e): e is string => !!e)
    await doSend(
      pickerAttendee.display_name,
      phones,
      emails,
      pickerAttendee.total,
      pickerAttendee.id,
      true,
      pickerAttendee.groupMembers
    )
    setPickerAttendee(null)
    setPickerSelected(new Set())
  }

  function togglePickerMember(i: number) {
    setPickerSelected(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i); else next.add(i)
      return next
    })
  }

  function resetAndClose() {
    setOpen(false)
    setSentIds(new Set())
    setToast(null)
    setPickerAttendee(null)
    setPickerSelected(new Set())
  }

  const methodHint =
    method === 'sms'
      ? 'Opens Messages or SMS app'
      : method === 'email'
      ? 'Opens your email app'
      : 'Uses share sheet or copies to clipboard'

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gwfc-green py-3.5 text-sm font-semibold text-white active:opacity-90"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" fill="currentColor" stroke="none" />
        </svg>
        Share with everyone
      </button>

      {/* Group member multi-select picker sub-sheet */}
      {pickerAttendee && (
        <div className="fixed inset-0 z-[60] flex items-end">
          <div className="fixed inset-0 bg-black/40" onClick={() => { setPickerAttendee(null); setPickerSelected(new Set()) }} />
          <div className="relative w-full rounded-t-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4">
              <div>
                <p className="text-sm font-semibold text-gwfc-blue">Send to</p>
                <p className="text-xs text-slate-400">{pickerAttendee.display_name}</p>
              </div>
              <button type="button" onClick={() => { setPickerAttendee(null); setPickerSelected(new Set()) }}
                className="text-slate-400 hover:text-slate-600" aria-label="Close">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            {pickerAttendee.groupMembers.map((m, i) => {
              const hasContact = method === 'sms' ? !!m.phone : method === 'email' ? !!m.email : !!(m.phone || m.email)
              const checked = pickerSelected.has(i)
              return (
                <button
                  key={i}
                  type="button"
                  disabled={!hasContact}
                  onClick={() => togglePickerMember(i)}
                  className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3.5 last:border-0 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-40"
                >
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                    checked ? 'border-teal-600 bg-teal-600' : 'border-slate-300 bg-white'
                  }`}>
                    {checked && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                        <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="truncate text-sm font-medium text-gwfc-blue">{m.display_name}</p>
                    <p className="text-xs text-slate-400">{m.phone ?? m.email ?? 'No contact info'}</p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-gwfc-blue">${m.total.toFixed(2)}</p>
                </button>
              )
            })}
            <div className="border-t border-slate-100 px-4 py-3">
              <button
                type="button"
                onClick={handlePickerSend}
                disabled={pickerSelected.size === 0}
                className="w-full rounded-xl bg-gwfc-green py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {method === 'sms'
                  ? `Send SMS${pickerSelected.size > 1 ? ' to group thread' : ''}`
                  : method === 'email'
                  ? `Send email${pickerSelected.size > 1 ? ' to both' : ''}`
                  : 'Share'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main bottom sheet */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="fixed inset-0 bg-black/40" onClick={resetAndClose} />
          <div className="relative flex max-h-[90vh] w-full flex-col rounded-t-2xl bg-white shadow-xl">

            <div className="shrink-0 border-b border-slate-100 px-4 pt-4 pb-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gwfc-blue">Send to attendees</p>
                <button type="button" onClick={resetAndClose}
                  className="text-slate-400 hover:text-slate-600" aria-label="Close">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {organiserPayid ? (
                <button type="button" onClick={copyPayid}
                  className="mt-3 flex w-full items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200">
                  <div className="text-left">
                    <p className="text-xs text-slate-400">PayID ({organiserPayidLabel ?? 'Other'})</p>
                    <p className="text-sm font-semibold text-gwfc-blue">{organiserPayid}</p>
                  </div>
                  <span className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                    payidCopied ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {payidCopied ? 'Copied!' : 'Copy'}
                  </span>
                </button>
              ) : (
                <button type="button"
                  onClick={() => { resetAndClose(); router.push('/profile') }}
                  className="mt-3 flex w-full items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200">
                  <p className="text-xs text-slate-400">Add your PayID so people know where to pay</p>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"
                    stroke="#94a3b8" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              )}

              <div className="mt-3 flex gap-1 rounded-xl bg-slate-100 p-1">
                {(['link', 'email', 'sms'] as Method[]).map(m => (
                  <button key={m} type="button" onClick={() => setMethod(m)}
                    className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-colors ${
                      method === m ? 'bg-gwfc-green text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}>
                    {m === 'link' ? 'Link' : m === 'email' ? 'Email' : 'SMS'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {attendees.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-slate-400">No other attendees.</p>
              ) : (
                attendees.map(attendee => {
                  const sent = sentIds.has(attendee.id)
                  const isGroup = attendee.groupMembers.length > 0
                  const contactableMembers = isGroup
                    ? attendee.groupMembers.filter(m =>
                        method === 'sms' ? !!m.phone : method === 'email' ? !!m.email : !!(m.phone || m.email)
                      )
                    : []
                  const disabled = !isGroup && (
                    (method === 'sms' && !attendee.phone) ||
                    (method === 'email' && !attendee.email)
                  )
                  const groupDisabled = isGroup && contactableMembers.length === 0

                  return (
                    <div key={attendee.id}
                      className={`flex items-center gap-3 border-b border-slate-100 px-4 py-3.5 last:border-0 transition-opacity ${sent ? 'opacity-50' : ''}`}>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gwfc-blue">{attendee.display_name}</p>
                        <p className="text-xs text-slate-400">${attendee.total.toFixed(2)}</p>
                        {(disabled || groupDisabled) && !sent && (
                          <p className="text-xs text-slate-400">
                            {method === 'sms' ? 'No phone number' : 'No email'}
                          </p>
                        )}
                        {isGroup && !groupDisabled && !sent && contactableMembers.length > 1 && (
                          <p className="text-xs text-slate-400">
                            {contactableMembers.map(m => m.display_name).join(', ')}
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
                          disabled={disabled || groupDisabled}
                          className="shrink-0 rounded-xl bg-gwfc-green px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          {isGroup && contactableMembers.length > 1 ? 'Choose…' : 'Send'}
                        </button>
                      )}
                    </div>
                  )
                })
              )}
            </div>

            <div className="shrink-0 border-t border-slate-100 bg-white px-4 py-3">
              <p className="text-center text-xs text-slate-400">{toast ?? methodHint}</p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
