'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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

interface Props {
  userId: string
}

type Step = 1 | 2 | 3

function StepIndicator({ step }: { step: Step }) {
  return (
    <div className="mb-6 flex justify-center gap-2">
      {([1, 2, 3] as Step[]).map(s => (
        <div
          key={s}
          className={`h-1.5 w-8 rounded-full transition-colors ${step >= s ? 'bg-zinc-900' : 'bg-zinc-200'}`}
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
    const { contacts } = await Contacts.getContacts({
      projection: { name: true, phones: true },
    })
    return contacts
      .filter((c: any) => c.name?.display)
      .map((c: any) => ({
        id: crypto.randomUUID(),
        display_name: c.name.display as string,
        phone: c.phones?.[0]?.number ?? null,
        email: null,
      }))
  } catch {
    return null
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const inputClass =
  'w-full rounded-lg px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 shadow-sm ring-1 ring-zinc-300 outline-none focus:ring-2 focus:ring-zinc-900'

export function NewGroupForm({ userId }: Props) {
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

  // Step 3
  const [saved, setSaved] = useState(false)
  const [savedName, setSavedName] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      { id: crypto.randomUUID(), display_name: newName.trim(), phone: phoneVal, email: emailVal },
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
  }

  function toggleImport(gm: SavedGroupMember) {
    if (importedIds.has(gm.id)) {
      setMembers(prev => prev.filter(m => m.importedFrom !== gm.id))
      setImportedIds(s => { const n = new Set(s); n.delete(gm.id); return n })
    } else {
      setMembers(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
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
    const contacts = await tryImportContacts()
    if (contacts === null) return
    setMembers(prev => {
      const existing = new Set(prev.map(m => m.display_name))
      return [...prev, ...contacts.filter(c => !existing.has(c.display_name))]
    })
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
        members.map(m => ({
          group_id: group.id,
          display_name: m.display_name,
          phone: m.phone ?? null,
          email: m.email ?? null,
        }))
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
          <h2 className="text-lg font-semibold text-zinc-900">Name your group</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Give this group a name you&apos;ll recognise later.
          </p>
        </div>
        <div>
          <label htmlFor="group-name" className="block text-sm font-medium text-zinc-700">
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
          className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continue
        </button>
      </div>
    )
  }

  // ── Step 2: Add members ──────────────────────────────────────────────────────

  if (step === 2) {
    return (
      <div className="space-y-6">
        <StepIndicator step={2} />
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Add members</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Add the people you split bills with. Each person needs at least a phone number or email.
          </p>
        </div>

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
              className="rounded-lg px-2 py-2.5 text-sm text-zinc-900 shadow-sm ring-1 ring-zinc-300 outline-none focus:ring-2 focus:ring-zinc-900"
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
              className="min-w-0 flex-1 rounded-lg px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 shadow-sm ring-1 ring-zinc-300 outline-none focus:ring-2 focus:ring-zinc-900"
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
            className="w-full rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add member
          </button>
        </form>

        {/* Import from contacts (native only) */}
        <button
          type="button"
          onClick={handleImportContacts}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-300 py-2.5 text-sm font-medium text-zinc-500 hover:border-zinc-400 hover:text-zinc-700"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"
            stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="8" r="3.5" />
            <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
            <path d="M19 8v6M16 11h6" />
          </svg>
          Import from contacts
        </button>

        {/* Add from existing group */}
        {groupsLoaded && savedGroups.length > 0 && (
          <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-zinc-200">
            <p className="border-b border-zinc-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Add from existing group
            </p>
            {savedGroups.map((g, i) => (
              <div key={g.id} className={i > 0 ? 'border-t border-zinc-100' : ''}>
                <button
                  type="button"
                  onClick={() => setExpandedGroupId(expandedGroupId === g.id ? null : g.id)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-zinc-50"
                >
                  <span className="text-sm font-medium text-zinc-900">{g.name}</span>
                  <svg
                    width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"
                    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
                    className={`shrink-0 transition-transform ${expandedGroupId === g.id ? 'rotate-180' : ''}`}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {expandedGroupId === g.id && (
                  <div className="border-t border-zinc-100">
                    {(g.group_members ?? []).length === 0 ? (
                      <p className="px-4 py-3 text-sm text-zinc-400">No members in this group.</p>
                    ) : (
                      (g.group_members ?? []).map(gm => {
                        const imported = importedIds.has(gm.id)
                        return (
                          <button
                            key={gm.id}
                            type="button"
                            onClick={() => toggleImport(gm)}
                            className="flex w-full items-center gap-3 px-4 py-2.5 hover:bg-zinc-50"
                          >
                            <span
                              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                                imported ? 'border-zinc-900 bg-zinc-900' : 'border-zinc-300 bg-white'
                              }`}
                            >
                              {imported && (
                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                                  <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </span>
                            <div className="min-w-0 text-left">
                              <p className="truncate text-sm text-zinc-900">{gm.display_name}</p>
                              {(gm.phone || gm.email) && (
                                <p className="truncate text-xs text-zinc-400">{gm.phone ?? gm.email}</p>
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
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Added ({members.length})
            </p>
            <ul className="space-y-2">
              {members.map(m => (
                <li key={m.id} className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-zinc-200">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-900">{m.display_name}</p>
                    {(m.phone || m.email) && (
                      <p className="truncate text-xs text-zinc-400">{m.phone ?? m.email}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeMember(m.id)}
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
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="flex-1 rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-200"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => setStep(3)}
            disabled={members.length === 0}
            className="flex-1 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
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
        <h2 className="text-lg font-semibold text-zinc-900">Options</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Saving the group lets you reuse it for future splits.
        </p>
      </div>

      {/* Member summary */}
      <div className="rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-zinc-200">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Members</p>
        <p className="mt-1 text-sm text-zinc-700">{members.map(m => m.display_name).join(', ')}</p>
      </div>

      {/* Save toggle */}
      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-zinc-200">
        <div className="flex items-center justify-between px-4 py-4">
          <div>
            <p className="text-sm font-medium text-zinc-900">Save this group</p>
            <p className="text-xs text-zinc-400">Appears in your saved groups on the home screen</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={saved}
            onClick={handleSaveToggle}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${saved ? 'bg-zinc-900' : 'bg-zinc-200'}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${saved ? 'translate-x-6' : 'translate-x-1'}`}
            />
          </button>
        </div>
        {saved && (
          <div className="border-t border-zinc-100 px-4 pb-4">
            <label htmlFor="saved-name" className="block text-sm font-medium text-zinc-700">
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
          className="flex-1 rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-200"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || (saved && !savedName.trim())}
          className="flex-1 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Creating…' : 'Create Group'}
        </button>
      </div>
    </div>
  )
}
