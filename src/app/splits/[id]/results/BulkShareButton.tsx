'use client'

import { useState } from 'react'
import { shareText } from '@/lib/share'

interface Props {
  token: string
  splitTitle: string
}

export function BulkShareButton({ token, splitTitle }: Props) {
  const [state, setState] = useState<'idle' | 'copied'>('idle')

  async function handleShare() {
    const url = `${window.location.origin}/share/${token}`
    const result = await shareText({
      title: splitTitle,
      text: `${splitTitle} — here's how the bill broke down. Check what you owe:`,
      url,
    })
    if (result === 'copied') {
      setState('copied')
      setTimeout(() => setState('idle'), 2500)
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gwfc-green py-3.5 text-sm font-semibold text-white active:opacity-90"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="22" y1="2" x2="11" y2="13" />
        <polygon points="22 2 15 22 11 13 2 9 22 2" fill="currentColor" stroke="none" />
      </svg>
      {state === 'copied' ? 'Link copied!' : 'Share with everyone'}
    </button>
  )
}
