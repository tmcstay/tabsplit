'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { generateId } from '@/lib/uuid'
import { ContactPicker, type Contact } from '@/components/ContactPicker'
import { addFavourite, removeFavourite } from '@/app/favourites/actions'

const DIAL_CODES = [
  { code: '+61', label: 'AU +61' },
  { code: '+1',  label: 'US/CA +1' },
  { code: '+44', label: 'UK +44' },
  { code: '+64', label: 'NZ +64' },
  { code: '+65', label: 'SG +65' },
  { code: '+86', label: 'CN +86' },
  { code: '+91', label: 'IN +91' },
] as const

interface Member {
  id: string
  display_name: string
  phone: string | null
  email: string | null
  importedFrom?: string
}

interface SavedGroupMember {
  id: string
  display_name: string
  phone: string | null
  email: string | null
}

interface SavedGroup {
  id: string
  name: string
  group_members: SavedGroupMember[]
}

interface FavouriteContact {
  id: string
  display_name: string
  phone: string | null
  email: string | null
}

interface Props {
  userId: string
  favourites: FavouriteContact[]
}

type Step = 1 | 2 | 3

function StepIndicator({ step }: { step: Step }) {
  return (
    <div className="mb-6 flex justify-center gap-2">
      {([1, 2, 3] as Step[]).map(s => (
        <div
          key={s}
          className={`h-1.5 w-8 rounded-full transition-colors ${step >= s ? 'bg-teal-600' : 'bg-slate-200'}`}
        />
      ))}
    </div>
  )
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function tryImportContacts(): Promise<Member[] | null> {
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

const inputClass =
  'w-full rounded-lg px-3 py-2.5 text-sm text-gwfc-blue placeholder-slate-400 shadow-sm ring-1 ring-slate-300 outline-none focus:ring-2 focus:ring-teal-500'

interface MergeGroup {
  id: string
  label: string
  memberIds: string[]
}

export function NewGroupForm({ userId, favourites }: Props) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [step, setStep] = useState<Step>(1)
  const [name, setName] = useState('')
  const [members, setMembers] = useState<Member[]>([])

  // Add member form
  const [newName, setNewName] = useState('')
  const [dialCode, setDialCode] = useState('+61')
  const [newPhone, setNewPhone] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [addError, setAddError] = useState<string | null>(null)

  // Import from existing groups
  const [savedGroups, setSavedGroups] = useState<SavedGroup[]>([])
  const [groupsLoaded, setGroupsLoaded] = useState(false)
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null)
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set())

  // Merge groups
  const [mergeGroups, setMergeGroups] = useState<MergeGroup[]>([])
  const [showMergeSheet, setShowMergeSheet] = useState(false)
  const [mergeSheetSelected, setMergeSheetSelected] = useState<string[]>([])
  const [mergeSheetLabel, setMergeSheetLabel] = useState('')
  const [mergeSheetLabelEdited, setMergeSheetLabelEdited] = useState(false)

  // Step 3
  const [saved, setSaved] = useState(false)
  const [savedName, setSavedName] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [contactsMessage, setContactsMessage] = useState<string | null>(null)
  const [favMap, setFavMap] = useState<Map<string, string>>(
    () => new Map(favourites.map(f => [f.display_name.toLowerCase().trim(), f.id]))
  )
  const [pickerContacts, setPickerContacts] = useState<Contact[]>([])
  const [showPicker, setShowPicker] = useState(false)

  useEffect(() => {
    if (groupsLoaded) return
    supabase
      .from('groups')
      .select('id, name, group_members(id, display_name, phone, email)')
      .eq('saved', true)
      .order('name', { ascending: true })
      .then(({ data }) => {
        setSavedGroups((data as unknown as SavedGroup[]) ?? [])
        setGroupsLoaded(true)
      })
  }, [groupsLoaded, supabase])

  async function handleToggleFav(name: string, phone: string | null, email: string | null) {
    const key = name.toLowerCase().trim()
    const existingId = favMap.get(key)
    if (existingId) {
      setFavMap(prev => { const m = new Map(prev); m.delete(key); return m })
      try { await removeFavourite(existingId) } catch {
        setFavMap(prev => new Map([...prev, [key, existingId]]))
      }
    } else {
      const tempId = `temp-${key}`
      setFavMap(prev => new Map([...prev, [key, tempId]]))
      try {
        const realId = await addFavourite(name, phone, email)
        setFavMap(prev => { const m = new Map(prev); m.set(key, realId); return m })
      } catch {
        setFavMap(prev => { const m = new Map(prev); m.delete(key); return m })
      }
    }
  }

  function starBtn(name: string, phone: string | null, email: string | null) {
    const isFav = favMap.has(name.toLowerCase().trim())
    return (
      <button type="button" onClick={() => handleToggleFav(name, phone, email)}
        className={`shrink-0 transition-colors ${isFav ? 'text-amber-400' : 'text-slate-300 hover:text-amber-300'}`}
        aria-label={isFav ? 'Remove from favourites' : 'Add to favourites'}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill={isFav ? 'currentColor' : 'none'}
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      </button>
    )
  }

  function addMember(e: React.FormEvent) {
    e.preventDefault()
    setAddError(null)
    if (!newName.trim()) return
    const phoneVal = newPhone.trim() ? `${dialCode}${newPhone.trim()}` : null
    const emailVal = newEmail.trim() || null
    if (!phoneVal && !emailVal) {
      setAddError('Please enter a phone number or email address.')
      return
    }
    setMembers(prev => [
      ...prev,
      { id: generateId(), display_name: newName.trim(), phone: phoneVal, email: emailVal },
    ])
    setNewName('')
    setNewPhone('')
    setNewEmail('')
  }

  function removeMember(id: string) {
    setMembers(prev => {
      const member = prev.find(m => m.id === id)
      if (member?.importedFrom) {
        setImportedIds(s => { const n = new Set(s); n.delete(member.importedFrom!); return n })
      }
      return prev.filter(m => m.id !== id)
    })
    setMergeGroups(prev =>
      prev
        .map(g => ({ ...g, memberIds: g.memberIds.filter(mid => mid !== id) }))
        .filter(g => g.memberIds.length >= 2)
    )
  }

  function defaultMergeLabel(ids: string[]): string {
    const names = ids
      .map(id => members.find(m => m.id === id)?.display_name ?? '')
      .filter(Boolean)
      .map(n => n.split(' ')[0])
    if (names.length === 0) return ''
    if (names.length === 2) return `${names[0]} & ${names[1]}`
    return names.slice(0, -1).join(', ') + ' & ' + names[names.length - 1]
  }

  function toggleMergeSheetSelect(id: string) {
    setMergeSheetSelected(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      if (!mergeSheetLabelEdited) setMergeSheetLabel(defaultMergeLabel(next))
      return next
    })
  }

  function handleConfirmMergeSheet() {
    if (mergeSheetSelected.length < 2) return
    const newId = generateId()
    const label = mergeSheetLabel.trim() || defaultMergeLabel(mergeSheetSelected)
    setMergeGroups(prev => {
      const filtered = prev
        .map(g => ({ ...g, memberIds: g.memberIds.filter(id => !mergeSheetSelected.includes(id)) }))
        .filter(g => g.memberIds.length >= 2)
      return [...filtered, { id: newId, label, memberIds: mergeSheetSelected }]
    })
    setMergeSheetSelected([])
    setMergeSheetLabel('')
    setMergeSheetLabelEdited(false)
    setShowMergeSheet(false)
  }

  function removeMergeGroup(groupId: string) {
    setMergeGroups(prev => prev.filter(g => g.id !== groupId))
  }

  function toggleImport(gm: SavedGroupMember) {
    if (importedIds.has(gm.id)) {
      setMembers(prev => prev.filter(m => m.importedFrom !== gm.id))
      setImportedIds(s => { const n = new Set(s); n.delete(gm.id); return n })
    } else {
      setMembers(prev => [
        ...prev,
        {
          id: generateId(),
          display_name: gm.display_name,
          phone: gm.phone,
          email: gm.email,
          importedFrom: gm.id,
        },
      ])
      setImportedIds(s => new Set([...s, gm.id]))
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

  function handlePickerAdd(selected: Contact[]) {
    setMembers(prev => {
      const existing = new Set(prev.map(m => m.display_name))
      return [
        ...prev,
        ...selected
          .filter(c => !existing.has(c.display_name))
          .map(c => ({ id: c.id, display_name: c.display_name, phone: c.phone, email: c.email })),
      ]
    })
    setShowPicker(false)
    setPickerContacts([])
  }

  function handleSaveToggle() {
    const next = !saved
    setSaved(next)
    if (next && !savedName) setSavedName(name)
  }

  async function handleSubmit() {
    setError(null)
    setLoading(true)

    const groupName = saved ? (savedName.trim() || name.trim()) : name.trim()

    const { data: group, error: groupErr } = await supabase
      .from('groups')
      .insert({ organiser_id: userId, name: groupName, saved })
      .select()
      .single()

    if (groupErr || !group) {
      setError('Failed to create group. Please try again.')
      setLoading(false)
      return
    }

    if (members.length > 0) {
      const { error: membersErr } = await supabase.from('group_members').insert(
        members.map(m => {
          const mergeGroup = mergeGroups.find(g => g.memberIds.includes(m.id))
          return {
            group_id: group.id,
            display_name: m.display_name,
            phone: m.phone ?? null,
            email: m.email ?? null,
            merge_group_id: mergeGroup?.id ?? null,
            merge_label: mergeGroup?.label ?? null,
          }
        })
      )
      if (membersErr) {
        setError('Group created but some members could not be saved.')
        setLoading(false)
        return
      }
    }

    router.push(`/groups/${group.id}`)
  }

  // ── Step 1: Group name ──────────────────────────────────────────────────────

  if (step === 1) {
    return (
      <div className="space-y-6">
        <StepIndicator step={1} />
        <div>
          <h2 className="text-lg font-semibold text-gwfc-blue">Name your group</h2>
          <p className="mt-1 text-sm text-slate-500">
            Give this group a name you&apos;ll recognise later.
          </p>
        </div>
        <div>
          <label htmlFor="group-name" className="block text-sm font-medium text-slate-700">
            Group name
          </label>
          <input
            id="group-name"
            type="text"
            placeholder="e.g. Housemates, Friday crew"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
            className={`mt-1.5 ${inputClass}`}
          />
        </div>
        <button
          type="button"
          onClick={() => setStep(2)}
          disabled={!name.trim()}
          className="w-full rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continue
        </button>
      </div>
    )
  }

  // ── Step 2: Add members ──────────────────────────────────────────────────────

  if (step === 2) {
    const alreadyMergedIds = new Set(mergeGroups.flatMap(g => g.memberIds))
    const availableForMerge = members.filter(m => !alreadyMergedIds.has(m.id))

    return (
      <div className="space-y-6">
        {showPicker && (
          <ContactPicker
            contacts={pickerContacts}
            existingNames={new Set(members.map(m => m.display_name))}
            onAdd={handlePickerAdd}
            onClose={() => { setShowPicker(false); setPickerContacts([]) }}
          />
        )}

        {/* Merge bottom sheet */}
        {showMergeSheet && (
          <div className="fixed inset-0 z-50 flex items-end">
            <div className="fixed inset-0 bg-black/40" onClick={() => { setShowMergeSheet(false); setMergeSheetSelected([]); setMergeSheetLabel(''); setMergeSheetLabelEdited(false) }} />
            <div className="relative flex max-h-[80vh] w-full flex-col rounded-t-2xl bg-white shadow-xl">
              <div className="shrink-0 border-b border-slate-100 px-4 py-4 flex items-center justify-between">
                <p className="text-sm font-semibold text-gwfc-blue">Merge members</p>
                <button type="button" onClick={() => { setShowMergeSheet(false); setMergeSheetSelected([]); setMergeSheetLabel(''); setMergeSheetLabelEdited(false) }} className="text-slate-400 hover:text-slate-600" aria-label="Close">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {availableForMerge.map(m => {
                  const selected = mergeSheetSelected.includes(m.id)
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleMergeSheetSelect(m.id)}
                      className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3.5 last:border-0 hover:bg-slate-50 active:bg-slate-100"
                    >
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${selected ? 'border-teal-600 bg-teal-600' : 'border-slate-300 bg-white'}`}>
                        {selected && (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                            <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                      <span className="text-sm font-medium text-gwfc-blue">{m.display_name}</span>
                    </button>
                  )
                })}
              </div>
              {mergeSheetSelected.length >= 2 && (
                <div className="shrink-0 border-t border-slate-100 px-4 py-4 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Merge label</label>
                    <input
                      type="text"
                      value={mergeSheetLabel}
                      onChange={e => { setMergeSheetLabel(e.target.value); setMergeSheetLabelEdited(true) }}
                      placeholder="e.g. Alice & Bob"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-gwfc-blue placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleConfirmMergeSheet}
                    className="w-full rounded-2xl bg-gwfc-blue py-3.5 text-sm font-semibold text-white"
                  >
                    Merge {mergeSheetSelected.length} members
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        <StepIndicator step={2} />
        <div>
          <h2 className="text-lg font-semibold text-gwfc-blue">Add members</h2>
          <p className="mt-1 text-sm text-slate-500">
            Add the people you split bills with. Each person needs at least a phone number or email.
          </p>
        </div>

        {/* Favourites quick-add */}
        {favourites.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Favourites</p>
            <div className="flex flex-wrap gap-2">
              {favourites.map(f => {
                const alreadyAdded = members.some(
                  m => m.display_name.toLowerCase().trim() === f.display_name.toLowerCase().trim()
                )
                return (
                  <button
                    key={f.id}
                    type="button"
                    disabled={alreadyAdded}
                    onClick={() => {
                      if (alreadyAdded) return
                      setMembers(prev => [
                        ...prev,
                        { id: generateId(), display_name: f.display_name, phone: f.phone, email: f.email },
                      ])
                    }}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                      alreadyAdded
                        ? 'bg-slate-100 text-slate-300'
                        : 'bg-amber-50 text-amber-700 hover:bg-amber-100 active:bg-amber-200'
                    }`}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24"
                      fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      className={alreadyAdded ? 'text-slate-300' : 'text-amber-400'}>
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                    {f.display_name}
                    {alreadyAdded ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Manual add form */}
        <form onSubmit={addMember} className="space-y-2.5">
          <input
            type="text"
            placeholder="Name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className={inputClass}
          />
          <div className="flex gap-2">
            <select
              value={dialCode}
              onChange={e => setDialCode(e.target.value)}
              className="rounded-lg px-2 py-2.5 text-sm text-gwfc-blue shadow-sm ring-1 ring-slate-300 outline-none focus:ring-2 focus:ring-teal-500"
            >
              {DIAL_CODES.map(d => (
                <option key={d.code} value={d.code}>{d.label}</option>
              ))}
            </select>
            <input
              type="tel"
              placeholder="Mobile number (optional)"
              value={newPhone}
              onChange={e => setNewPhone(e.target.value)}
              className="min-w-0 flex-1 rounded-lg px-3 py-2.5 text-sm text-gwfc-blue placeholder-slate-400 shadow-sm ring-1 ring-slate-300 outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <input
            type="email"
            placeholder="Email address (optional)"
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            className={inputClass}
          />
          {addError && <p className="text-xs text-red-600">{addError}</p>}
          <button
            type="submit"
            disabled={!newName.trim()}
            className="w-full rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add member
          </button>
        </form>

        {/* Import from contacts (native only) */}
        <button
          type="button"
          onClick={handleImportContacts}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 py-2.5 text-sm font-medium text-slate-500 hover:border-slate-400 hover:text-slate-700"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"
            stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="8" r="3.5" />
            <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
            <path d="M19 8v6M16 11h6" />
          </svg>
          Import from contacts
        </button>
        {contactsMessage && (
          <p className="text-center text-xs text-slate-400">{contactsMessage}</p>
        )}

        {/* Add from existing group */}
        {groupsLoaded && savedGroups.length > 0 && (
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            <p className="border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Add from existing group
            </p>
            {savedGroups.map((g, i) => (
              <div key={g.id} className={i > 0 ? 'border-t border-slate-100' : ''}>
                <button
                  type="button"
                  onClick={() => setExpandedGroupId(expandedGroupId === g.id ? null : g.id)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50"
                >
                  <span className="text-sm font-medium text-gwfc-blue">{g.name}</span>
                  <svg
                    width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"
                    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
                    className={`shrink-0 transition-transform ${expandedGroupId === g.id ? 'rotate-180' : ''}`}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {expandedGroupId === g.id && (
                  <div className="border-t border-slate-100">
                    {(g.group_members ?? []).length === 0 ? (
                      <p className="px-4 py-3 text-sm text-slate-400">No members in this group.</p>
                    ) : (
                      (g.group_members ?? []).map(gm => {
                        const imported = importedIds.has(gm.id)
                        return (
                          <button
                            key={gm.id}
                            type="button"
                            onClick={() => toggleImport(gm)}
                            className="flex w-full items-center gap-3 px-4 py-2.5 hover:bg-slate-50"
                          >
                            <span
                              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                                imported ? 'border-teal-600 bg-teal-600' : 'border-slate-300 bg-white'
                              }`}
                            >
                              {imported && (
                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                                  <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </span>
                            <div className="min-w-0 text-left">
                              <p className="truncate text-sm text-gwfc-blue">{gm.display_name}</p>
                              {(gm.phone || gm.email) && (
                                <p className="truncate text-xs text-slate-400">{gm.phone ?? gm.email}</p>
                              )}
                            </div>
                          </button>
                        )
                      })
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Added members list */}
        {members.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Added ({members.length})
            </p>
            <ul className="space-y-2">
              {members.map(m => (
                <li key={m.id} className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gwfc-blue">{m.display_name}</p>
                    {(m.phone || m.email) && (
                      <p className="truncate text-xs text-slate-400">{m.phone ?? m.email}</p>
                    )}
                  </div>
                  {starBtn(m.display_name, m.phone, m.email)}
                  <button
                    type="button"
                    onClick={() => removeMember(m.id)}
                    className="shrink-0 text-slate-400 hover:text-red-500"
                    aria-label={`Remove ${m.display_name}`}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"
                      stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Merge section */}
        {(mergeGroups.length > 0 || availableForMerge.length >= 2) && (
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Merges</p>
            {mergeGroups.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {mergeGroups.map(g => (
                  <span key={g.id} className="flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-700 ring-1 ring-teal-200">
                    {g.label}
                    <button
                      type="button"
                      onClick={() => removeMergeGroup(g.id)}
                      className="ml-0.5 text-teal-500 hover:text-teal-800"
                      aria-label={`Remove merge ${g.label}`}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            )}
            {availableForMerge.length >= 2 && (
              <button
                type="button"
                onClick={() => { setShowMergeSheet(true); setMergeSheetSelected([]); setMergeSheetLabel(''); setMergeSheetLabelEdited(false) }}
                className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <path d="M8.59 13.51l4.83 2.98M13.41 7.51L8.59 10.49" />
                </svg>
                Merge members
              </button>
            )}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="flex-1 rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => setStep(3)}
            disabled={members.length === 0}
            className="flex-1 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      </div>
    )
  }

  // ── Step 3: Options & submit ────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <StepIndicator step={3} />
      <div>
        <h2 className="text-lg font-semibold text-gwfc-blue">Options</h2>
        <p className="mt-1 text-sm text-slate-500">
          Saving the group lets you reuse it for future splits.
        </p>
      </div>

      {/* Member summary */}
      <div className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Members</p>
        <p className="mt-1 text-sm text-slate-700">{members.map(m => m.display_name).join(', ')}</p>
      </div>

      {/* Save toggle */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between px-4 py-4">
          <div>
            <p className="text-sm font-medium text-gwfc-blue">Save this group</p>
            <p className="text-xs text-slate-400">Appears in your saved groups on the home screen</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={saved}
            onClick={handleSaveToggle}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${saved ? 'bg-teal-600' : 'bg-slate-200'}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${saved ? 'translate-x-6' : 'translate-x-1'}`}
            />
          </button>
        </div>
        {saved && (
          <div className="border-t border-slate-100 px-4 pb-4">
            <label htmlFor="saved-name" className="block text-sm font-medium text-slate-700">
              Group name
            </label>
            <input
              id="saved-name"
              type="text"
              value={savedName}
              onChange={e => setSavedName(e.target.value)}
              className={`mt-1.5 ${inputClass}`}
            />
          </div>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setStep(2)}
          className="flex-1 rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || (saved && !savedName.trim())}
          className="flex-1 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Creating…' : 'Create Group'}
        </button>
      </div>
    </div>
  )
}
