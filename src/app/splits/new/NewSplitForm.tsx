'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSplit } from './actions'

interface Attendee {
  id: string
  display_name: string
  phone: string | null
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
          className={`h-1.5 w-8 rounded-full transition-colors ${step >= s ? 'bg-zinc-900' : 'bg-zinc-200'}`}
        />
      ))}
    </div>
  )
}

export function NewSplitForm({ userId: _userId, groupId, groupName, initialAttendees }: Props) {
  console.log('NewSplitForm render — initialAttendees:', initialAttendees.length, 'groupId:', groupId)
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>(1)
  const [title, setTitle] = useState('')
  const [attendees, setAttendees] = useState<Attendee[]>(initialAttendees)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [receipt, setReceipt] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addAttendee(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setAttendees(prev => [
      ...prev,
      { id: crypto.randomUUID(), display_name: newName.trim(), phone: newPhone.trim() || null },
    ])
    setNewName('')
    setNewPhone('')
  }

  function removeAttendee(id: string) {
    setAttendees(prev => prev.filter(a => a.id !== id))
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setReceipt(file)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(file ? URL.createObjectURL(file) : null)
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
        attendees.map(a => ({ display_name: a.display_name, phone: a.phone }))
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
          <h2 className="text-lg font-semibold text-zinc-900">Name this split</h2>
          {groupName && (
            <p className="mt-1 text-sm text-zinc-500">Splitting with {groupName}</p>
          )}
        </div>
        <div>
          <label htmlFor="split-title" className="block text-sm font-medium text-zinc-700">
            Split title
          </label>
          <input
            id="split-title"
            type="text"
            placeholder="e.g. Dinner at Tipo 00"
            value={title}
            onChange={e => setTitle(e.target.value)}
            autoFocus
            className="mt-1.5 w-full rounded-lg px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 shadow-sm ring-1 ring-zinc-300 outline-none focus:ring-2 focus:ring-zinc-900"
          />
        </div>
        <button
          type="button"
          onClick={() => setStep(2)}
          disabled={!title.trim()}
          className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
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
          <h2 className="text-lg font-semibold text-zinc-900">Who&apos;s splitting?</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {groupName ? `Pre-filled from ${groupName}. Remove anyone who isn't here.` : 'Add everyone sharing this bill.'}
          </p>
        </div>

        {/* Attendees list */}
        {attendees.length > 0 && (
          <ul className="space-y-2">
            {attendees.map(a => (
              <li key={a.id} className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-zinc-200">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-900">{a.display_name}</p>
                  {a.phone && <p className="text-xs text-zinc-400">{a.phone}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => removeAttendee(a.id)}
                  className="ml-3 shrink-0 text-zinc-400 hover:text-red-500"
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
        <form onSubmit={addAttendee} className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Name"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="min-w-0 flex-1 rounded-lg px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 shadow-sm ring-1 ring-zinc-300 outline-none focus:ring-2 focus:ring-zinc-900"
            />
            <input
              type="tel"
              placeholder="Phone (optional)"
              value={newPhone}
              onChange={e => setNewPhone(e.target.value)}
              className="w-36 rounded-lg px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 shadow-sm ring-1 ring-zinc-300 outline-none focus:ring-2 focus:ring-zinc-900"
            />
          </div>
          <button
            type="submit"
            disabled={!newName.trim()}
            className="w-full rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-200 disabled:opacity-50"
          >
            Add person
          </button>
        </form>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="flex-1 rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-200"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => setStep(3)}
            disabled={attendees.length === 0}
            className="flex-1 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      </div>
    )
  }

  // ── Step 3: Receipt ────────────────────────────────────────────────────────

  return (
    <div className="pb-24">
    <div className="space-y-6">
      <StepIndicator step={3} />
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Upload the receipt</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Take a photo or choose from your gallery. You can also skip and add it later.
        </p>
      </div>

      {/* Receipt preview or upload trigger */}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="relative flex w-full flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 py-10 transition-colors hover:border-zinc-400 hover:bg-zinc-100"
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
              stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            <p className="mt-3 text-sm font-medium text-zinc-500">Tap to take a photo or choose a file</p>
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
        <p className="text-center text-xs text-zinc-400">{receipt.name}</p>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      <div className="relative z-50 flex gap-3">
        <button
          type="button"
          onClick={() => setStep(2)}
          className="flex-1 rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-200"
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => { console.log('button clicked'); handleSubmit() }}
          disabled={loading}
          className="flex-1 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Creating…' : receipt ? 'Create Split' : 'Skip & Create'}
        </button>
      </div>
    </div>
    </div>
  )
}
