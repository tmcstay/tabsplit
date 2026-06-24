'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSplit } from './actions'
import { generateId } from '@/lib/uuid'

interface Attendee {
  id: string
  display_name: string
  phone: string | null
  email: string | null
}

interface Props {
  userId: string
  groupId: string | null
  groupName: string | null
  initialAttendees: Attendee[]
}

type Step = 1 | 2 | 3

function StepIndicator({ step }: { step: Step }) {
  return (
    <div className="mb-6 flex justify-center gap-2">
      {([1, 2, 3] as Step[]).map(s => (
        <div
          key={s}
          className={`h-1.5 w-8 rounded-full transition-colors ${step >= s ? 'bg-teal-600' : 'bg-slate-200'}`}
        />
      ))}
    </div>
  )
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function tryImportContacts(): Promise<Attendee[] | null> {
  try {
    const isNative =
      typeof window !== 'undefined' &&
      (window as any).Capacitor?.isNativePlatform?.()
    if (!isNative) return null
    const { Contacts } = await import('@capacitor-community/contacts' as any)
    const { contacts: permission } = await Contacts.requestPermissions()
    if (permission !== 'granted') return null
    const { contacts } = await Contacts.getContacts({
      projection: { name: true, phones: true, emails: true },
    })
    return contacts
      .filter((c: any) => c.name?.display)
      .map((c: any) => ({
        id: generateId(),
        display_name: c.name.display as string,
        phone: c.phones?.[0]?.number ?? null,
        email: c.emails?.[0]?.address ?? null,
      }))
  } catch {
    return null
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function NewSplitForm({ userId: _userId, groupId, groupName, initialAttendees }: Props) {
  console.log('NewSplitForm render — initialAttendees:', initialAttendees.length, 'groupId:', groupId)
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>(1)
  const [title, setTitle] = useState('')
  const [attendees, setAttendees] = useState<Attendee[]>(initialAttendees)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [receipt, setReceipt] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [contactsMessage, setContactsMessage] = useState<string | null>(null)

  function addAttendee(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setAttendees(prev => [
      ...prev,
      {
        id: generateId(),
        display_name: newName.trim(),
        phone: newPhone.trim() || null,
        email: newEmail.trim() || null,
      },
    ])
    setNewName('')
    setNewPhone('')
    setNewEmail('')
  }

  function removeAttendee(id: string) {
    setAttendees(prev => prev.filter(a => a.id !== id))
  }

  async function handleImportContacts() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isNative = !!(window as any).Capacitor?.isNativePlatform?.()
    if (!isNative) {
      setContactsMessage('Contact import is only available in the native app.')
      setTimeout(() => setContactsMessage(null), 3000)
      return
    }
    const contacts = await tryImportContacts()
    if (contacts === null) return
    setAttendees(prev => {
      const existing = new Set(prev.map(a => a.display_name))
      return [...prev, ...contacts.filter(c => !existing.has(c.display_name))]
    })
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    console.log('handleFileChange:', file ? { name: file.name, size: file.size, type: file.type, lastModified: file.lastModified } : null)
    // Mobile Safari can return a File with size=0 — treat as valid if it has a name
    const validFile = file && (file.size > 0 || file.name.length > 0) ? file : null
    setReceipt(validFile)
    console.log('setReceipt called with:', validFile?.name, validFile?.size)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(validFile ? URL.createObjectURL(validFile) : null)
  }

  async function handleSubmit() {
    console.log('handleSubmit fired')
    setError(null)
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('title', title)
      fd.append('groupId', groupId ?? '')
      fd.append('attendees', JSON.stringify(
        attendees.map(a => ({ display_name: a.display_name, phone: a.phone, email: a.email }))
      ))
      if (receipt) fd.append('receipt', receipt)

      const splitId = await createSplit(fd)
      router.push(`/splits/${splitId}`)
    } catch (err) {
      if (err instanceof Error && err.message.includes('NEXT_REDIRECT')) throw err
      console.error('createSplit error:', err)
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  // ── Step 1: Title ──────────────────────────────────────────────────────────

  if (step === 1) {
    return (
      <div className="space-y-6">
        <StepIndicator step={1} />
        <div>
          <h2 className="text-lg font-semibold text-gwfc-blue">Name this split</h2>
          {groupName && (
            <p className="mt-1 text-sm text-slate-500">Splitting with {groupName}</p>
          )}
        </div>
        <div>
          <label htmlFor="split-title" className="block text-sm font-medium text-slate-700">
            Split title
          </label>
          <input
            id="split-title"
            type="text"
            placeholder="e.g. Dinner at Tipo 00"
            value={title}
            onChange={e => setTitle(e.target.value)}
            autoFocus
            className="mt-1.5 w-full rounded-lg px-3 py-2.5 text-sm text-gwfc-blue placeholder-slate-400 shadow-sm ring-1 ring-slate-300 outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <button
          type="button"
          onClick={() => setStep(2)}
          disabled={!title.trim()}
          className="w-full rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continue
        </button>
      </div>
    )
  }

  // ── Step 2: Attendees ──────────────────────────────────────────────────────

  if (step === 2) {
    return (
      <div className="space-y-6">
        <StepIndicator step={2} />
        <div>
          <h2 className="text-lg font-semibold text-gwfc-blue">Who&apos;s splitting?</h2>
          <p className="mt-1 text-sm text-slate-500">
            {groupName ? `Pre-filled from ${groupName}. Remove anyone who isn't here.` : 'Add everyone sharing this bill.'}
          </p>
        </div>

        {/* Attendees list */}
        {attendees.length > 0 && (
          <ul className="space-y-2">
            {attendees.map(a => (
              <li key={a.id} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gwfc-blue">{a.display_name}</p>
                  {(a.phone || a.email) && (
                    <p className="truncate text-xs text-slate-400">{a.phone ?? a.email}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeAttendee(a.id)}
                  className="ml-3 shrink-0 text-slate-400 hover:text-red-500"
                  aria-label={`Remove ${a.display_name}`}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"
                    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Add attendee */}
        <form onSubmit={addAttendee} className="space-y-2.5">
          <input
            type="text"
            placeholder="Name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="w-full rounded-lg px-3 py-2.5 text-sm text-gwfc-blue placeholder-slate-400 shadow-sm ring-1 ring-slate-300 outline-none focus:ring-2 focus:ring-teal-500"
          />
          <input
            type="tel"
            placeholder="Phone (optional)"
            value={newPhone}
            onChange={e => setNewPhone(e.target.value)}
            className="w-full rounded-lg px-3 py-2.5 text-sm text-gwfc-blue placeholder-slate-400 shadow-sm ring-1 ring-slate-300 outline-none focus:ring-2 focus:ring-teal-500"
          />
          <input
            type="email"
            placeholder="Email (optional)"
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            className="w-full rounded-lg px-3 py-2.5 text-sm text-gwfc-blue placeholder-slate-400 shadow-sm ring-1 ring-slate-300 outline-none focus:ring-2 focus:ring-teal-500"
          />
          <button
            type="submit"
            disabled={!newName.trim()}
            className="w-full rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
          >
            Add person
          </button>
        </form>

        {/* Import from contacts (native only) */}
        <button
          type="button"
          onClick={handleImportContacts}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 py-2.5 text-sm font-medium text-slate-500 hover:border-slate-400 hover:text-slate-700"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"
            stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="8" r="3.5" />
            <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
            <path d="M19 8v6M16 11h6" />
          </svg>
          Import from contacts
        </button>
        {contactsMessage && (
          <p className="text-center text-xs text-slate-400">{contactsMessage}</p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="flex-1 rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => setStep(3)}
            disabled={attendees.length === 0}
            className="flex-1 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      </div>
    )
  }

  // ── Step 3: Receipt ────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 pb-32">
      <StepIndicator step={3} />
      <div>
        <h2 className="text-lg font-semibold text-gwfc-blue">Upload the receipt</h2>
        <p className="mt-1 text-sm text-slate-500">
          Load a photo of the receipt to split the bill.
        </p>
      </div>

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="relative flex w-full flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 py-10 transition-colors hover:border-slate-400 hover:bg-slate-100"
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Receipt preview"
            className="max-h-72 w-full rounded-xl object-contain"
          />
        ) : (
          <>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true"
              stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            <p className="mt-3 text-sm font-medium text-slate-500">Tap to choose a photo</p>
          </>
        )}
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        aria-label="Upload receipt image"
      />

      {receipt && (
        <p className="text-center text-xs text-slate-400">{receipt.name}</p>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      <div className="relative z-50 flex gap-3">
        <button
          type="button"
          onClick={() => setStep(2)}
          className="flex-1 rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
        >
          Back
        </button>
        {receipt ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
                Creating…
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                Create Split
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
            </svg>
            Load file
          </button>
        )}
      </div>
    </div>
  )
}
