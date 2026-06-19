'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { unfinaliseSplit } from '../actions'

export function EditButton({ splitId }: { splitId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function handleEdit() {
    setBusy(true)
    try {
      await unfinaliseSplit(splitId)
      router.push(`/splits/${splitId}`)
    } catch {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleEdit}
      disabled={busy}
      className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"
        stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
      {busy ? 'Opening…' : 'Edit'}
    </button>
  )
}
