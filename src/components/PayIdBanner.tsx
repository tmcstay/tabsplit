'use client'

import { useState } from 'react'

export function PayIdBanner({
  organiseName,
  payid,
  payidLabel,
}: {
  organiseName: string | null
  payid: string
  payidLabel: string | null
}) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(payid)
    } catch {
      // Fallback for older browsers
      const el = document.createElement('input')
      el.value = payid
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const name = organiseName ?? 'the organiser'
  const label = payidLabel ? ` via PayID (${payidLabel})` : ' via PayID'

  return (
    <div className="rounded-xl bg-teal-50 px-4 py-4 ring-1 ring-teal-200">
      <p className="text-xs font-medium text-teal-700">
        Pay {name}{label}
      </p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-lg font-semibold text-slate-900 break-all">{payid}</p>
        <button
          onClick={handleCopy}
          className="shrink-0 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 active:bg-teal-700"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  )
}
