'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Tables } from '@/types/database'
import { removeFavourite, addFavourite } from '@/app/favourites/actions'
import { ContactPicker, type Contact } from '@/components/ContactPicker'
import { generateId } from '@/lib/uuid'

interface GroupMember {
  id: string
  display_name: string
  phone: string | null
  email: string | null
}

export type GroupWithMembers = Tables<'groups'> & { group_members: GroupMember[] }
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

function GroupCard({ group }: { group: GroupWithMembers }) {
  const count = group.group_members.length
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

/* eslint-disable @typescript-eslint/no-explicit-any */
async function tryImportContacts(): Promise<Contact[] | null> {
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

// Group member picker sheet
function GroupPicker({
  groups,
  existingNames,
  onSelectGroup,
  onClose,
}: {
  groups: GroupWithMembers[]
  existingNames: Set<string>
  onSelectGroup: (members: Contact[]) => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex max-h-[75vh] w-full flex-col rounded-t-2xl bg-white shadow-xl">
        <div className="shrink-0 border-b border-slate-100 px-4 pt-4 pb-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gwfc-blue">Add from group</p>
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-400">Tap a group to add all its members to favourites</p>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {groups.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-400">No saved groups.</p>
          ) : groups.map(group => {
            const newMembers = group.group_members.filter(
              m => !existingNames.has(m.display_name.toLowerCase().trim())
            )
            return (
              <button
                key={group.id}
                type="button"
                onClick={() => onSelectGroup(group.group_members.map(m => ({ id: m.id, display_name: m.display_name, phone: m.phone, email: m.email })))}
                className="flex w-full items-center gap-3 px-4 py-3.5 hover:bg-slate-50 active:bg-slate-100 text-left"
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: getGradient(group.id) }}
                >
                  <GroupsIcon />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gwfc-blue">{group.name}</p>
                  <p className="text-xs text-slate-400">
                    {group.group_members.length} {group.group_members.length === 1 ? 'member' : 'members'}
                    {newMembers.length < group.group_members.length && ` · ${group.group_members.length - newMembers.length} already saved`}
                  </p>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"
                  stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const inputCls = 'w-full rounded-lg px-3 py-2.5 text-sm text-gwfc-blue placeholder-slate-400 shadow-sm ring-1 ring-slate-300 outline-none focus:ring-2 focus:ring-teal-500'

interface Props {
  groups: GroupWithMembers[]
  favourites: Favourite[]
}

export function GroupsPageClient({ groups, favourites: initialFavourites }: Props) {
  const [tab, setTab] = useState<'groups' | 'favourites'>('groups')
  const [favs, setFavs] = useState(initialFavourites)

  // Add favourite form
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [adding, setAdding] = useState(false)

  // Contacts / group picker
  const [pickerContacts, setPickerContacts] = useState<Contact[]>([])
  const [showPicker, setShowPicker] = useState(false)
  const [showGroupPicker, setShowGroupPicker] = useState(false)
  const [contactsMessage, setContactsMessage] = useState<string | null>(null)

  const existingFavNames = new Set(favs.map(f => f.display_name.toLowerCase().trim()))

  function handleRemoveFav(id: string) {
    setFavs(prev => prev.filter(f => f.id !== id))
  }

  async function handleAddFav(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim() || adding) return
    setAdding(true)
    const name = newName.trim()
    const phone = newPhone.trim() || null
    const email = newEmail.trim() || null
    const tempId = `temp-${Date.now()}`
    const optimistic: Favourite = {
      id: tempId,
      user_id: '',
      display_name: name,
      phone,
      email,
      created_at: new Date().toISOString(),
    }
    setFavs(prev => [...prev, optimistic])
    setNewName('')
    setNewPhone('')
    setNewEmail('')
    try {
      const realId = await addFavourite(name, phone, email)
      setFavs(prev => prev.map(f => f.id === tempId ? { ...f, id: realId } : f))
    } catch {
      setFavs(prev => prev.filter(f => f.id !== tempId))
    } finally {
      setAdding(false)
    }
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
    setPickerContacts(contacts)
    setShowPicker(true)
  }

  function handleGroupSelect(members: Contact[]) {
    setShowGroupPicker(false)
    setPickerContacts(members)
    setShowPicker(true)
  }

  async function handlePickerAdd(selected: Contact[]) {
    setShowPicker(false)
    setPickerContacts([])
    for (const contact of selected) {
      const key = contact.display_name.toLowerCase().trim()
      if (existingFavNames.has(key)) continue
      const tempId = `temp-${key}-${Date.now()}`
      const optimistic: Favourite = {
        id: tempId,
        user_id: '',
        display_name: contact.display_name,
        phone: contact.phone,
        email: contact.email,
        created_at: new Date().toISOString(),
      }
      setFavs(prev => [...prev, optimistic])
      try {
        const realId = await addFavourite(contact.display_name, contact.phone, contact.email)
        setFavs(prev => prev.map(f => f.id === tempId ? { ...f, id: realId } : f))
      } catch {
        setFavs(prev => prev.filter(f => f.id !== tempId))
      }
    }
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
          {favs.length > 0 && (
            <div className="mb-4 space-y-3">
              {favs.map(fav => (
                <FavouriteCard key={fav.id} fav={fav} onRemove={handleRemoveFav} />
              ))}
            </div>
          )}

          {/* Import buttons */}
          <div className="mb-3 flex gap-2">
            <button
              type="button"
              onClick={handleImportContacts}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-indigo-50 px-3 py-2.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-100 active:bg-indigo-100"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              From contacts
            </button>
            {groups.length > 0 && (
              <button
                type="button"
                onClick={() => setShowGroupPicker(true)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-teal-50 px-3 py-2.5 text-xs font-semibold text-teal-600 hover:bg-teal-100 active:bg-teal-100"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="7" r="3" />
                  <path d="M2 19c0-3 2.7-5 7-5" />
                  <circle cx="17" cy="9" r="2.5" />
                  <path d="M22 19c0-2.2-1.8-4-5-4" />
                </svg>
                From group
              </button>
            )}
          </div>

          {contactsMessage && (
            <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">{contactsMessage}</p>
          )}

          {/* Manual add form */}
          <form onSubmit={handleAddFav} className="space-y-2.5 rounded-2xl bg-white px-4 py-4 shadow-sm ring-1 ring-slate-200">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Add manually</p>
            <input
              type="text"
              placeholder="Name"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className={inputCls}
            />
            <input
              type="tel"
              placeholder="Phone (optional)"
              value={newPhone}
              onChange={e => setNewPhone(e.target.value)}
              className={inputCls}
            />
            <input
              type="email"
              placeholder="Email (optional)"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              className={inputCls}
            />
            <button
              type="submit"
              disabled={!newName.trim() || adding}
              className="w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {adding ? 'Adding…' : 'Add to favourites'}
            </button>
          </form>
        </>
      )}

      {/* Contact picker */}
      {showPicker && (
        <ContactPicker
          contacts={pickerContacts}
          existingNames={existingFavNames}
          onAdd={handlePickerAdd}
          onClose={() => { setShowPicker(false); setPickerContacts([]) }}
        />
      )}

      {/* Group picker */}
      {showGroupPicker && (
        <GroupPicker
          groups={groups}
          existingNames={existingFavNames}
          onSelectGroup={handleGroupSelect}
          onClose={() => setShowGroupPicker(false)}
        />
      )}
    </main>
  )
}
