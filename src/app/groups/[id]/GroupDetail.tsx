'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Tables } from '@/types/database'

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

interface Props {
  group: Tables<'groups'>
  members: Tables<'group_members'>[]
}

const inputClass =
  'w-full rounded-lg px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 shadow-sm ring-1 ring-zinc-300 outline-none focus:ring-2 focus:ring-zinc-900'

export function GroupDetail({ group, members }: Props) {
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
  }

  function removeNewMember(id: string) {
    setNewMembers(prev => prev.filter(m => m.id !== id))
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
      { id: crypto.randomUUID(), display_name: addName.trim(), phone: phoneVal, email: emailVal },
    ])
    setAddName('')
    setAddPhone('')
    setAddEmail('')
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
        if (nameChanged || phoneChanged || emailChanged) {
          const { error } = await supabase
            .from('group_members')
            .update({
              display_name: edits.display_name.trim() || orig.display_name,
              phone: edits.phone.trim() || null,
              email: edits.email.trim() || null,
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
          newMembers.map(m => ({
            group_id: group.id,
            display_name: m.display_name,
            phone: m.phone,
            email: m.email,
          }))
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
    return (
      <>
        <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white px-4 py-4">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              className="min-w-0 flex-1 rounded-lg px-3 py-2 text-lg font-bold text-zinc-900 ring-1 ring-zinc-300 outline-none focus:ring-2 focus:ring-zinc-900"
            />
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdits}
                disabled={editLoading || !editName.trim()}
                className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {editLoading ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 space-y-6 px-4 py-6 pb-24">
          {editError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{editError}</p>
          )}

          {/* Existing members */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Members</p>
            {localMembers.length === 0 && newMembers.length === 0 ? (
              <p className="py-4 text-sm text-zinc-400">No members yet.</p>
            ) : (
              <ul className="space-y-2">
                {localMembers.map(m => {
                  const edits = memberEdits[m.id] ?? { display_name: m.display_name, phone: m.phone ?? '', email: m.email ?? '' }
                  const isExpanded = expandedMemberId === m.id
                  return (
                    <li key={m.id} className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-zinc-200">
                      {/* Collapsed row */}
                      <div className="flex items-center gap-2 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-zinc-900">{edits.display_name}</p>
                          {(edits.phone || edits.email) && (
                            <p className="truncate text-xs text-zinc-400">{edits.phone || edits.email}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setExpandedMemberId(isExpanded ? null : m.id)}
                          className="shrink-0 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
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
                          className="shrink-0 rounded-lg p-1.5 text-zinc-400 hover:text-red-500"
                          aria-label={`Remove ${m.display_name}`}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"
                            stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                            <path d="M18 6 6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </div>

                      {/* Expanded edit form */}
                      {isExpanded && (
                        <div className="space-y-2.5 border-t border-zinc-100 px-4 pb-4 pt-3">
                          <div>
                            <label className="block text-xs font-medium text-zinc-500">Name</label>
                            <input
                              type="text"
                              value={edits.display_name}
                              onChange={e => updateMemberEdit(m.id, 'display_name', e.target.value)}
                              className={`mt-1 ${inputClass}`}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-zinc-500">Phone</label>
                            <input
                              type="tel"
                              placeholder="e.g. +61412345678"
                              value={edits.phone}
                              onChange={e => updateMemberEdit(m.id, 'phone', e.target.value)}
                              className={`mt-1 ${inputClass}`}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-zinc-500">Email</label>
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
                            className="w-full rounded-lg bg-zinc-100 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200"
                          >
                            Done
                          </button>
                        </div>
                      )}
                    </li>
                  )
                })}

                {/* New (unsaved) members */}
                {newMembers.map(m => (
                  <li key={m.id} className="flex items-center justify-between rounded-xl bg-zinc-50 px-4 py-3 shadow-sm ring-1 ring-zinc-200">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-900">{m.display_name}</p>
                      {(m.phone || m.email) && (
                        <p className="truncate text-xs text-zinc-400">{m.phone ?? m.email}</p>
                      )}
                      <p className="text-xs italic text-zinc-400">New</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeNewMember(m.id)}
                      className="ml-3 shrink-0 text-zinc-400 hover:text-red-500"
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
            )}
          </div>

          {/* Add member form */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Add member</p>
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
                  className="rounded-lg px-2 py-2.5 text-sm text-zinc-900 shadow-sm ring-1 ring-zinc-300 outline-none focus:ring-2 focus:ring-zinc-900"
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
                  className="min-w-0 flex-1 rounded-lg px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 shadow-sm ring-1 ring-zinc-300 outline-none focus:ring-2 focus:ring-zinc-900"
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
                className="w-full rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add member
              </button>
            </form>
          </div>
        </main>
      </>
    )
  }

  // ── View mode ──────────────────────────────────────────────────────────────

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="text-zinc-400 hover:text-zinc-600"
              aria-label="Go back"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"
                stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900">{group.name}</h1>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={enterEditMode}
              className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
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
                  className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
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
                    <div className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-zinc-200">
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

      <main className="flex-1 px-4 py-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Members — {checkedCount} attending
        </p>

        {members.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-400">No members in this group yet.</p>
        ) : (
          <ul className="space-y-2">
            {members.map(member => (
              <li key={member.id}>
                <button
                  type="button"
                  onClick={() => toggleMember(member.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 shadow-sm ring-1 transition-colors ${
                    checked[member.id] ? 'bg-white ring-zinc-200' : 'bg-zinc-50 ring-zinc-100'
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                      checked[member.id] ? 'border-zinc-900 bg-zinc-900' : 'border-zinc-300 bg-white'
                    }`}
                  >
                    {checked[member.id] && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                        <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <div className="min-w-0 text-left">
                    <p className={`truncate text-sm font-medium ${checked[member.id] ? 'text-zinc-900' : 'text-zinc-400'}`}>
                      {member.display_name}
                    </p>
                    {(member.phone || member.email) && (
                      <p className="truncate text-xs text-zinc-400">{member.phone ?? member.email}</p>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-16 px-4 pb-3">
        <button
          type="button"
          onClick={handleAddBill}
          disabled={checkedCount === 0}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-900 py-3.5 text-sm font-semibold text-white shadow-lg transition-colors active:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
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
