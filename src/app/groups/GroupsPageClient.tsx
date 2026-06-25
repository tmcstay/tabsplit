'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Tables } from '@/types/database'
import { removeFavourite } from '@/app/favourites/actions'

type GroupWithCount = Tables<'groups'> & { group_members: [{ count: number }] | [] }
type Favourite = Tables<'favourite_contacts'>

const GRADIENTS = [
  'linear-gradient(135deg, #14b8a6, #3b82f6)',
  'linear-gradient(135deg, #f97316, #ef4444)',
  'linear-gradient(135deg, #8b5cf6, #6366f1)',
  'linear-gradient(135deg, #1caebb, #1079bf)',
]

function getGradient(id: string): string {
  const hash = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return GRADIENTS[hash % GRADIENTS.length]
}

function GroupsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"
      stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="7" r="3.5" />
      <path d="M2 20c0-3.3 3.1-6 7-6s7 2.7 7 6" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M22 20c0-2.2-1.8-4-4-4" />
    </svg>
  )
}

function GroupCard({ group }: { group: GroupWithCount }) {
  const count = group.group_members[0]?.count ?? 0
  return (
    <Link
      href={`/groups/${group.id}`}
      className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3.5 shadow-sm ring-1 ring-slate-200 active:bg-slate-50"
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ background: getGradient(group.id) }}
      >
        <GroupsIcon />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-gwfc-blue">{group.name}</p>
        <p className="mt-0.5 text-xs text-slate-400">
          {count} {count === 1 ? 'member' : 'members'}
        </p>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"
        stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </Link>
  )
}

function FavouriteCard({ fav, onRemove }: { fav: Favourite; onRemove: (id: string) => void }) {
  const [removing, setRemoving] = useState(false)

  async function handleRemove() {
    setRemoving(true)
    try {
      await removeFavourite(fav.id)
      onRemove(fav.id)
    } catch {
      setRemoving(false)
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3.5 shadow-sm ring-1 ring-slate-200">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"
          className="text-amber-400">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-gwfc-blue">{fav.display_name}</p>
        <p className="mt-0.5 text-xs text-slate-400">{fav.phone ?? fav.email ?? 'No contact info'}</p>
      </div>
      <button
        type="button"
        onClick={handleRemove}
        disabled={removing}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-40 transition-colors"
        aria-label="Remove from favourites"
      >
        {removing ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" className="animate-spin" aria-hidden="true">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        )}
      </button>
    </div>
  )
}

interface Props {
  groups: GroupWithCount[]
  favourites: Favourite[]
}

export function GroupsPageClient({ groups, favourites: initialFavourites }: Props) {
  const [tab, setTab] = useState<'groups' | 'favourites'>('groups')
  const [favs, setFavs] = useState(initialFavourites)

  function handleRemoveFav(id: string) {
    setFavs(prev => prev.filter(f => f.id !== id))
  }

  return (
    <main className="flex-1 px-4 py-5">
      {/* Tab switcher */}
      <div className="mb-5 flex rounded-xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setTab('groups')}
          className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-colors ${
            tab === 'groups' ? 'bg-white text-gwfc-blue shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Groups
        </button>
        <button
          type="button"
          onClick={() => setTab('favourites')}
          className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-colors ${
            tab === 'favourites' ? 'bg-white text-gwfc-blue shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Favourites
        </button>
      </div>

      {tab === 'groups' ? (
        <>
          {groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true"
                  stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="7" r="3.5" />
                  <path d="M2 20c0-3.3 3.1-6 7-6s7 2.7 7 6" />
                  <circle cx="17" cy="9" r="2.5" />
                  <path d="M22 20c0-2.2-1.8-4-4-4" />
                </svg>
              </div>
              <p className="text-base font-semibold text-gwfc-blue">No saved groups yet</p>
              <p className="mt-1.5 max-w-xs text-sm text-slate-400">
                Create a group to quickly add the same people to future splits.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {groups.map(group => (
                <GroupCard key={group.id} group={group} />
              ))}
            </div>
          )}

          <Link
            href="/groups/new"
            className="mt-6 flex w-full items-center justify-center rounded-2xl bg-gwfc-blue py-3.5 text-sm font-semibold text-white shadow-sm active:opacity-90"
          >
            New Group
          </Link>
        </>
      ) : (
        <>
          {favs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"
                  className="text-amber-300">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </div>
              <p className="text-base font-semibold text-gwfc-blue">No favourites yet</p>
              <p className="mt-1.5 max-w-xs text-sm text-slate-400">
                Star a person on the results page to save them here for quick access.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {favs.map(fav => (
                <FavouriteCard key={fav.id} fav={fav} onRemove={handleRemoveFav} />
              ))}
            </div>
          )}
        </>
      )}
    </main>
  )
}
