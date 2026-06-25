'use client'

import { useState } from 'react'
import { PersonCard } from './PersonCard'
import type { PersonResult } from './PersonCard'
import { markPaid } from '../actions'
import { addFavourite, removeFavourite } from '@/app/favourites/actions'

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
  const [favouriteMap, setFavouriteMap] = useState<Record<string, { isFavourite: boolean; favouriteId: string | null }>>(
    () => Object.fromEntries(results.map(r => [r.id, { isFavourite: r.isFavourite, favouriteId: r.favouriteId }]))
  )

  async function handleTogglePaid(entityId: string, paid: boolean, isGroup: boolean) {
    setPaidMap(prev => ({ ...prev, [entityId]: paid }))
    await markPaid(splitId, entityId, paid, isGroup)
  }

  async function handleToggleFavourite(person: PersonResult) {
    const current = favouriteMap[person.id]
    if (current?.isFavourite && current.favouriteId) {
      setFavouriteMap(prev => ({ ...prev, [person.id]: { isFavourite: false, favouriteId: null } }))
      await removeFavourite(current.favouriteId)
    } else {
      setFavouriteMap(prev => ({ ...prev, [person.id]: { isFavourite: true, favouriteId: null } }))
      const newId = await addFavourite(person.label, person.phone, person.email)
      setFavouriteMap(prev => ({ ...prev, [person.id]: { isFavourite: true, favouriteId: newId } }))
    }
  }

  return (
    <>
      {results.map(person => {
        const favState = favouriteMap[person.id]
        return (
          <PersonCard
            key={person.id}
            person={{
              ...person,
              paid: paidMap[person.id] ?? person.paid,
              isFavourite: favState?.isFavourite ?? person.isFavourite,
              favouriteId: favState?.favouriteId ?? person.favouriteId,
            }}
            splitTitle={splitTitle}
            shareUrl={shareUrl}
            onTogglePaid={handleTogglePaid}
            onToggleFavourite={handleToggleFavourite}
          />
        )
      })}
    </>
  )
}
