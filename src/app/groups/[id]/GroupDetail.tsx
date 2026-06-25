'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Tables } from '@/types/database'
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

interface NewMember {
  id: string
  display_name: string
  phone: string | null
  email: string | null
}

interface MemberEdit {
  display_name: string
  phone: string
  email: string
}

interface MergeGroup {
  id: string
  label: string
  memberIds: string[]
}

interface FavouriteContact {
  id: string
  display_name: string
  phone: string | null
  email: string | null
}

interface Props {
  group: Tables<'groups'>
  members: Tables<'group_members'>[]
  favourites: FavouriteContact[]
}

const inputClass =
  'w-full rounded-lg px-3 py-2.5 text-sm text-gwfc-blue placeholder-slate-400 shadow-sm ring-1 ring-slate-300 outline-none focus:ring-2 focus:ring-teal-500'

/* eslint-disable @typescript-eslint/no-explicit-any */
async function tryImportContacts(): Promise<NewMember[] | null> {
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

export function GroupDetail({ group, members, favourites }: Props) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  // View mode
  const [checked, setChecked] = useState<Record<string, boolean>>(
    Object.fromEntries(members.map(m => [m.id, true]))
  )
  const [menuOpen, setMenuOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Edit mode
  const [editMode, setEditMode] = useState(false)
  const [editName, setEditName] = useState(group.name)
  const [localMembers, setLocalMembers] = useState(members)
  const [memberEdits, setMemberEdits] = useState<Record<string, MemberEdit>>({})
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null)
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set())
  const [newMembers, setNewMembers] = useState<NewMember[]>([])
  const [addName, setAddName] = useState('')
  const [addDialCode, setAddDialCode] = useState('+61')
  const [addPhone, setAddPhone] = useState('')
  const [addEmail, setAddEmail] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [contactsMessage, setContactsMessage] = useState<string | null>(null)
  const [pickerContacts, setPickerContacts] = useState<Contact[]>([])
  const [showPicker, setShowPicker] = useState(false)

  // Merge groups
  const [mergeGroups, setMergeGroups] = useState<MergeGroup[]>([])
  const [showMergeSheet, setShowMergeSheet] = useState(false)
  const [mergeSheetSelected, setMergeSheetSelected] = useState<string[]>([])
  const [mergeSheetLabel, setMergeSheetLabel] = useState('')
  const [mergeSheetLabelEdited, setMergeSheetLabelEdited] = useState(false)

  const [favMap, setFavMap] = useState<Map<string, string>>(
    () => new Map(favourites.map(f => [f.display_name.toLowerCase().trim(), f.id]))
  )

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
        className={`shrink-0 rounded-lg p-1.5 transition-colors ${isFav ? 'text-amber-400 hover:bg-amber-50' : 'text-slate-300 hover:bg-slate-100 hover:text-amber-300'}`}
        aria-label={isFav ? 'Remove from favourites' : 'Add to favourites'}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill={isFav ? 'currentColor' : 'none'}
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      </button>
    )
  }

  // Sync local state when server refreshes props
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChecked(Object.fromEntries(members.map(m => [m.id, true])))
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalMembers(members)
  }, [members])

  function toggleMember(id: string) {
    setChecked(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function handleAddBill() {
    const selectedIds = members
      .filter(m => checked[m.id])
      .map(m => m.id)
      .join(',')
    const params = new URLSearchParams({ group: group.id })
    if (selectedIds) params.set('members', selectedIds)
    router.push(`/splits/new?${params.toString()}`)
  }

  async function handleDelete() {
    if (!confirm(`Delete "${group.name}"? This cannot be undone.`)) return
    setDeleting(true)
    await supabase.from('groups').delete().eq('id', group.id)
    router.push('/')
  }

  function defaultMergeLabel(ids: string[]): string {
    const all: { id: string; display_name: string }[] = [...localMembers, ...newMembers]
    const names = ids
      .map(id => all.find(m => m.id === id)?.display_name ?? '')
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

  function getMergeGroupForMember(memberId: string): MergeGroup | undefined {
    return mergeGroups.find(g => g.memberIds.includes(memberId))
  }

  function enterEditMode() {
    setEditName(group.name)
    setLocalMembers(members)
    setMemberEdits(
      Object.fromEntries(
        members.map(m => [m.id, {
          display_name: m.display_name,
          phone: m.phone ?? '',
          email: m.email ?? '',
        }])
      )
    )
    setExpandedMemberId(null)
    setRemovedIds(new Set())
    setNewMembers([])
    setAddName('')
    setAddPhone('')
    setAddEmail('')
    setAddError(null)
    setEditError(null)
    setMenuOpen(false)

    // Initialise merge groups from existing member data
    const existingMergeMap: Record<string, { label: string; memberIds: string[] }> = {}
    for (const m of members) {
      if (m.merge_group_id) {
        if (!existingMergeMap[m.merge_group_id]) {
          existingMergeMap[m.merge_group_id] = { label: m.merge_label ?? '', memberIds: [] }
        }
        existingMergeMap[m.merge_group_id].memberIds.push(m.id)
      }
    }
    setMergeGroups(
      Object.entries(existingMergeMap)
        .filter(([, v]) => v.memberIds.length >= 2)
        .map(([id, v]) => ({ id, ...v }))
    )

    setEditMode(true)
  }

  function cancelEdit() {
    setEditMode(false)
    setExpandedMemberId(null)
  }

  function updateMemberEdit(id: string, field: keyof MemberEdit, value: string) {
    setMemberEdits(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }))
  }

  function removeExistingMember(id: string) {
    setLocalMembers(prev => prev.filter(m => m.id !== id))
    setRemovedIds(prev => new Set([...prev, id]))
    if (expandedMemberId === id) setExpandedMemberId(null)
    setMergeGroups(prev =>
      prev
        .map(g => ({ ...g, memberIds: g.memberIds.filter(mid => mid !== id) }))
        .filter(g => g.memberIds.length >= 2)
    )
  }

  function removeNewMember(id: string) {
    setNewMembers(prev => prev.filter(m => m.id !== id))
    setMergeGroups(prev =>
      prev
        .map(g => ({ ...g, memberIds: g.memberIds.filter(mid => mid !== id) }))
        .filter(g => g.memberIds.length >= 2)
    )
  }

  function addNewMember(e: React.FormEvent) {
    e.preventDefault()
    setAddError(null)
    if (!addName.trim()) return
    const phoneVal = addPhone.trim() ? `${addDialCode}${addPhone.trim()}` : null
    const emailVal = addEmail.trim() || null
    if (!phoneVal && !emailVal) {
      setAddError('Please enter a phone number or email address.')
      return
    }
    setNewMembers(prev => [
      ...prev,
      { id: generateId(), display_name: addName.trim(), phone: phoneVal, email: emailVal },
    ])
    setAddName('')
    setAddPhone('')
    setAddEmail('')
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
    setNewMembers(prev => {
      const existing = new Set([
        ...localMembers.map(m => m.display_name),
        ...prev.map(m => m.display_name),
      ])
      return [...prev, ...selected.filter(c => !existing.has(c.display_name))]
    })
    setShowPicker(false)
    setPickerContacts([])
  }

  async function handleSaveEdits() {
    setEditError(null)
    setEditLoading(true)
    try {
      // Update group name
      if (editName.trim() !== group.name) {
        const { error } = await supabase
          .from('groups')
          .update({ name: editName.trim() })
          .eq('id', group.id)
        if (error) throw new Error('Failed to update group name.')
      }

      // Update edited members
      for (const m of localMembers) {
        const edits = memberEdits[m.id]
        if (!edits) continue
        const orig = members.find(o => o.id === m.id)
        if (!orig) continue
        const nameChanged = edits.display_name.trim() !== orig.display_name
        const phoneChanged = (edits.phone.trim() || null) !== orig.phone
        const emailChanged = (edits.email.trim() || null) !== orig.email
        const mergeGroup = getMergeGroupForMember(m.id)
        const newMergeGroupId = mergeGroup?.id ?? null
        const newMergeLabel = mergeGroup?.label ?? null
        const mergeChanged = newMergeGroupId !== (orig.merge_group_id ?? null) || newMergeLabel !== (orig.merge_label ?? null)
        if (nameChanged || phoneChanged || emailChanged || mergeChanged) {
          const { error } = await supabase
            .from('group_members')
            .update({
              display_name: edits.display_name.trim() || orig.display_name,
              phone: edits.phone.trim() || null,
              email: edits.email.trim() || null,
              merge_group_id: newMergeGroupId,
              merge_label: newMergeLabel,
            })
            .eq('id', m.id)
          if (error) throw new Error(`Failed to update ${orig.display_name}.`)
        }
      }

      // Delete removed members
      if (removedIds.size > 0) {
        const { error } = await supabase
          .from('group_members')
          .delete()
          .in('id', [...removedIds])
        if (error) throw new Error('Failed to remove members.')
      }

      // Insert new members
      if (newMembers.length > 0) {
        const { error } = await supabase.from('group_members').insert(
          newMembers.map(m => {
            const mergeGroup = getMergeGroupForMember(m.id)
            return {
              group_id: group.id,
              display_name: m.display_name,
              phone: m.phone,
              email: m.email,
              merge_group_id: mergeGroup?.id ?? null,
              merge_label: mergeGroup?.label ?? null,
            }
          })
        )
        if (error) throw new Error('Failed to add new members.')
      }

      router.refresh()
      setEditMode(false)
      setExpandedMemberId(null)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setEditLoading(false)
    }
  }

  const checkedCount = Object.values(checked).filter(Boolean).length

  // ── Edit mode ──────────────────────────────────────────────────────────────

  if (editMode) {
    const alreadyMergedIds = new Set(mergeGroups.flatMap(g => g.memberIds))
    const allEditMembers: { id: string; display_name: string }[] = [...localMembers, ...newMembers]
    const availableForMerge = allEditMembers.filter(m => !alreadyMergedIds.has(m.id))

    return (
      <>
        {showPicker && (
          <ContactPicker
            contacts={pickerContacts}
            existingNames={new Set([
              ...localMembers.map(m => m.display_name),
              ...newMembers.map(m => m.display_name),
            ])}
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

        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 pb-4 safe-top">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              className="min-w-0 flex-1 rounded-lg px-3 py-2 text-lg font-bold text-gwfc-blue ring-1 ring-slate-300 outline-none focus:ring-2 focus:ring-teal-500"
            />
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdits}
                disabled={editLoading || !editName.trim()}
                className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {editLoading ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 space-y-6 px-4 py-6 pb-32">
          {editError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{editError}</p>
          )}

          {/* Existing members */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Members</p>
            {localMembers.length === 0 && newMembers.length === 0 ? (
              <p className="py-4 text-sm text-slate-400">No members yet.</p>
            ) : (
              <ul className="space-y-2">
                {localMembers.map(m => {
                  const edits = memberEdits[m.id] ?? { display_name: m.display_name, phone: m.phone ?? '', email: m.email ?? '' }
                  const isExpanded = expandedMemberId === m.id
                  const mergeGroup = getMergeGroupForMember(m.id)
                  return (
                    <li key={m.id} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
                      <div className="flex items-center gap-2 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gwfc-blue">{edits.display_name}</p>
                          {mergeGroup ? (
                            <p className="text-xs text-teal-600">{mergeGroup.label}</p>
                          ) : (edits.phone || edits.email) ? (
                            <p className="truncate text-xs text-slate-400">{edits.phone || edits.email}</p>
                          ) : null}
                        </div>
                        {starBtn(edits.display_name, edits.phone || null, edits.email || null)}
                        <button
                          type="button"
                          onClick={() => setExpandedMemberId(isExpanded ? null : m.id)}
                          className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                          aria-label={`Edit ${m.display_name}`}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"
                            stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeExistingMember(m.id)}
                          className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:text-red-500"
                          aria-label={`Remove ${m.display_name}`}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"
                            stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                            <path d="M18 6 6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="space-y-2.5 border-t border-slate-100 px-4 pb-4 pt-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-500">Name</label>
                            <input
                              type="text"
                              value={edits.display_name}
                              onChange={e => updateMemberEdit(m.id, 'display_name', e.target.value)}
                              className={`mt-1 ${inputClass}`}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-500">Phone</label>
                            <input
                              type="tel"
                              placeholder="e.g. +61412345678"
                              value={edits.phone}
                              onChange={e => updateMemberEdit(m.id, 'phone', e.target.value)}
                              className={`mt-1 ${inputClass}`}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-500">Email</label>
                            <input
                              type="email"
                              placeholder="e.g. name@example.com"
                              value={edits.email}
                              onChange={e => updateMemberEdit(m.id, 'email', e.target.value)}
                              className={`mt-1 ${inputClass}`}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => setExpandedMemberId(null)}
                            className="w-full rounded-lg bg-slate-100 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
                          >
                            Done
                          </button>
                        </div>
                      )}
                    </li>
                  )
                })}

                {/* New (unsaved) members */}
                {newMembers.map(m => {
                  const mergeGroup = getMergeGroupForMember(m.id)
                  return (
                    <li key={m.id} className="flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-3 shadow-sm ring-1 ring-slate-200">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gwfc-blue">{m.display_name}</p>
                        {mergeGroup ? (
                          <p className="text-xs text-teal-600">{mergeGroup.label}</p>
                        ) : (m.phone || m.email) ? (
                          <p className="truncate text-xs text-slate-400">{m.phone ?? m.email}</p>
                        ) : null}
                        <p className="text-xs italic text-slate-400">New</p>
                      </div>
                      {starBtn(m.display_name, m.phone, m.email)}
                      <button
                        type="button"
                        onClick={() => removeNewMember(m.id)}
                        className="shrink-0 text-slate-400 hover:text-red-500"
                        aria-label={`Remove ${m.display_name}`}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"
                          stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                          <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

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

          {/* Add member form */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Add member</p>
            <form onSubmit={addNewMember} className="space-y-2.5">
              <input
                type="text"
                placeholder="Name"
                value={addName}
                onChange={e => setAddName(e.target.value)}
                className={inputClass}
              />
              <div className="flex gap-2">
                <select
                  value={addDialCode}
                  onChange={e => setAddDialCode(e.target.value)}
                  className="rounded-lg px-2 py-2.5 text-sm text-gwfc-blue shadow-sm ring-1 ring-slate-300 outline-none focus:ring-2 focus:ring-teal-500"
                >
                  {DIAL_CODES.map(d => (
                    <option key={d.code} value={d.code}>{d.label}</option>
                  ))}
                </select>
                <input
                  type="tel"
                  placeholder="Mobile number (optional)"
                  value={addPhone}
                  onChange={e => setAddPhone(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg px-3 py-2.5 text-sm text-gwfc-blue placeholder-slate-400 shadow-sm ring-1 ring-slate-300 outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <input
                type="email"
                placeholder="Email address (optional)"
                value={addEmail}
                onChange={e => setAddEmail(e.target.value)}
                className={inputClass}
              />
              {addError && <p className="text-xs text-red-600">{addError}</p>}
              <button
                type="submit"
                disabled={!addName.trim()}
                className="w-full rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add member
              </button>
            </form>

            {/* Import from contacts (native only) */}
            <button
              type="button"
              onClick={handleImportContacts}
              className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 py-2.5 text-sm font-medium text-slate-500 hover:border-slate-400 hover:text-slate-700"
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
          </div>
        </main>
      </>
    )
  }

  // ── View mode ──────────────────────────────────────────────────────────────

  // Group members by merge_group_id for display
  const viewMergeMap: Record<string, Tables<'group_members'>[]> = {}
  for (const m of members) {
    if (m.merge_group_id) {
      if (!viewMergeMap[m.merge_group_id]) viewMergeMap[m.merge_group_id] = []
      viewMergeMap[m.merge_group_id].push(m)
    }
  }

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 pb-4 safe-top">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push('/groups')}
              className="text-slate-400 hover:text-slate-600"
              aria-label="Go back"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"
                stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <h1 className="text-xl font-bold tracking-tight text-gwfc-blue">{group.name}</h1>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={enterEditMode}
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Edit group"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"
                stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>

            {group.saved && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Group options"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <circle cx="12" cy="5" r="1.5" />
                    <circle cx="12" cy="12" r="1.5" />
                    <circle cx="12" cy="19" r="1.5" />
                  </svg>
                </button>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                    <div className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-slate-200">
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={deleting}
                        className="block w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        {deleting ? 'Deleting…' : 'Delete group'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 pb-40">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Members — {checkedCount} attending
        </p>

        {members.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">No members in this group yet.</p>
        ) : (
          <ul className="space-y-2">
            {members.map(member => (
              <li key={member.id}>
                <button
                  type="button"
                  onClick={() => toggleMember(member.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 shadow-sm ring-1 transition-colors ${
                    checked[member.id] ? 'bg-white ring-slate-200' : 'bg-slate-50 ring-slate-100'
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                      checked[member.id] ? 'border-teal-600 bg-teal-600' : 'border-slate-300 bg-white'
                    }`}
                  >
                    {checked[member.id] && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                        <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <div className="min-w-0 text-left">
                    <p className={`truncate text-sm font-medium ${checked[member.id] ? 'text-gwfc-blue' : 'text-slate-400'}`}>
                      {member.display_name}
                    </p>
                    {member.merge_group_id && member.merge_label ? (
                      <p className="text-xs text-teal-600">{member.merge_label}</p>
                    ) : (member.phone || member.email) ? (
                      <p className="truncate text-xs text-slate-400">{member.phone ?? member.email}</p>
                    ) : null}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      <div className="fixed inset-x-0 px-4 pb-3" style={{ bottom: 'calc(4rem + max(env(safe-area-inset-bottom), 12px))' }}>
        <button
          type="button"
          onClick={handleAddBill}
          disabled={checkedCount === 0}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-600 py-3.5 text-sm font-semibold text-white shadow-lg transition-colors active:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M9 9h6M9 12h6M9 15h4" />
          </svg>
          Add Bill
        </button>
      </div>
    </>
  )
}
