'use client'

import { useState } from 'react'
import { PersonCard } from './PersonCard'
import type { PersonResult } from './PersonCard'
import { markPaid } from '../actions'

interface ResultsListProps {
  results: PersonResult[]
  splitId: string
  splitTitle: string
  shareUrl: string | null
}

export function ResultsList({ results, splitId, splitTitle, shareUrl }: ResultsListProps) {
  const [paidMap, setPaidMap] = useState<Record<string, boolean>>(
    () => Object.fromEntries(results.map(r => [r.id, r.paid]))
  )

  async function handleTogglePaid(entityId: string, paid: boolean, isGroup: boolean) {
    setPaidMap(prev => ({ ...prev, [entityId]: paid }))
    await markPaid(splitId, entityId, paid, isGroup)
  }

  return (
    <>
      {results.map(person => (
        <PersonCard
          key={person.id}
          person={{ ...person, paid: paidMap[person.id] ?? person.paid }}
          splitTitle={splitTitle}
          shareUrl={shareUrl}
          onTogglePaid={handleTogglePaid}
        />
      ))}
    </>
  )
}
