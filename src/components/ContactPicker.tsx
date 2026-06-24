'use client'

import { useState, useMemo } from 'react'

export interface Contact {
  id: string
  display_name: string
  phone: string | null
  email: string | null
}

interface Props {
  contacts: Contact[]
  existingNames: Set<string>
  onAdd: (selected: Contact[]) => void
  onClose: () => void
}

function Checkbox({ checked, disabled }: { checked: boolean; disabled?: boolean }) {
  return (
    <span
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
        disabled
          ? 'border-slate-200 bg-slate-100'
          : checked
          ? 'border-gwfc-green bg-gwfc-green'
          : 'border-slate-300 bg-white'
      }`}
    >
      {checked && !disabled && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
          <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  )
}

export function ContactPicker({ contacts, existingNames, onAdd, onClose }: Props) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return q ? contacts.filter(c => c.display_name.toLowerCase().includes(q)) : contacts
  }, [contacts, search])

  const selectableFiltered = useMemo(
    () => filtered.filter(c => !existingNames.has(c.display_name)),
    [filtered, existingNames]
  )

  const allFilteredSelected =
    selectableFiltered.length > 0 && selectableFiltered.every(c => selected.has(c.id))

  function toggleSelectAll() {
    setSelected(prev => {
      const next = new Set(prev)
      if (allFilteredSelected) {
        selectableFiltered.forEach(c => next.delete(c.id))
      } else {
        selectableFiltered.forEach(c => next.add(c.id))
      }
      return next
    })
  }

  function toggleContact(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const selectedCount = selected.size

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex max-h-[85vh] w-full flex-col rounded-t-2xl bg-white shadow-xl">

        {/* Header */}
        <div className="shrink-0 border-b border-slate-100 px-4 pt-4 pb-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gwfc-blue">Import contacts</p>
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Search */}
          <div className="mt-3 flex items-center gap-2 rounded-lg px-3 ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-gwfc-light-blue">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"
              stroke="#94a3b8" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Search contacts…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 py-2 text-sm text-gwfc-blue placeholder-slate-400 outline-none"
              autoFocus
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-600" aria-label="Clear search">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Select all + counter */}
          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={toggleSelectAll}
              disabled={selectableFiltered.length === 0}
              className="flex items-center gap-2 disabled:opacity-40"
            >
              <Checkbox checked={allFilteredSelected} />
              <span className="text-sm text-slate-500">Select all</span>
            </button>
            <span className="text-xs text-slate-400">
              {selectedCount > 0 ? `${selectedCount} selected` : 'None selected'}
            </span>
          </div>
        </div>

        {/* Contact list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-400">No contacts found.</p>
          ) : (
            filtered.map(contact => {
              const alreadyAdded = existingNames.has(contact.display_name)
              const isSelected = selected.has(contact.id)
              return (
                <button
                  key={contact.id}
                  type="button"
                  onClick={() => !alreadyAdded && toggleContact(contact.id)}
                  disabled={alreadyAdded}
                  className={`flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-0 ${
                    alreadyAdded ? 'cursor-default' : 'hover:bg-slate-50 active:bg-slate-100'
                  }`}
                >
                  <Checkbox checked={isSelected} disabled={alreadyAdded} />
                  <div className="min-w-0 flex-1 text-left">
                    <p className={`truncate text-sm font-medium ${alreadyAdded ? 'text-slate-400' : 'text-gwfc-blue'}`}>
                      {contact.display_name}
                    </p>
                    {(contact.phone || contact.email) && (
                      <p className="truncate text-xs text-slate-400">{contact.phone ?? contact.email}</p>
                    )}
                    {alreadyAdded && (
                      <p className="text-xs italic text-slate-400">Already added</p>
                    )}
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-slate-100 bg-white px-4 py-4">
          <button
            type="button"
            onClick={() => onAdd(contacts.filter(c => selected.has(c.id)))}
            disabled={selectedCount === 0}
            className="w-full rounded-2xl bg-gwfc-blue py-3.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            {selectedCount > 0 ? `Add ${selectedCount} ${selectedCount === 1 ? 'person' : 'people'}` : 'Add selected'}
          </button>
        </div>
      </div>
    </div>
  )
}
