'use client'

import { useState, useTransition } from 'react'
import { savePayId } from './actions'

const PAYID_LABELS = ['Mobile', 'Email', 'BSB/Account', 'Other'] as const

const PLACEHOLDERS: Record<string, string> = {
  Mobile: '04XX XXX XXX',
  Email: 'you@example.com',
  'BSB/Account': '000-000 00000000',
  Other: '',
}

export function PayIdForm({
  initialPayid,
  initialPayidLabel,
}: {
  initialPayid: string | null
  initialPayidLabel: string | null
}) {
  const [payid, setPayid] = useState(initialPayid ?? '')
  const [payidLabel, setPayidLabel] = useState(initialPayidLabel ?? 'Mobile')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    startTransition(async () => {
      setStatus('saving')
      await savePayId(payid.trim() || null, payidLabel)
      setStatus('saved')
      setTimeout(() => setStatus('idle'), 2000)
    })
  }

  return (
    <div className="rounded-2xl bg-white px-4 py-4 shadow-sm ring-1 ring-slate-200 space-y-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Payment details
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Add your PayID so people splitting bills with you know where to send their share. This is for display only — TabSplit never processes payments.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">PayID type</label>
          <select
            value={payidLabel}
            onChange={e => setPayidLabel(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-gwfc-blue focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            {PAYID_LABELS.map(l => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">PayID</label>
          <input
            type="text"
            value={payid}
            onChange={e => setPayid(e.target.value)}
            placeholder={PLACEHOLDERS[payidLabel] ?? ''}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-gwfc-blue placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={isPending}
          className="w-full rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 active:bg-teal-700 disabled:opacity-50"
        >
          {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : 'Save'}
        </button>
      </div>
    </div>
  )
}
