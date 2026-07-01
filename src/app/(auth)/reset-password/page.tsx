'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type PageState = 'loading' | 'ready' | 'invalid' | 'success'

function PasswordInput({
  id,
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  autoComplete: string
  placeholder?: string
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="relative mt-1.5">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          placeholder={placeholder ?? '••••••••'}
          value={value}
          onChange={e => onChange(e.target.value)}
          required
          autoComplete={autoComplete}
          className="w-full rounded-lg px-3 py-2.5 pr-10 text-sm text-slate-900 placeholder-slate-400 shadow-sm ring-1 ring-slate-300 outline-none focus:ring-2 focus:ring-teal-500"
        />
        <button
          type="button"
          onClick={() => setVisible(v => !v)}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
          aria-label={visible ? 'Hide password' : 'Show password'}
          tabIndex={-1}
        >
          {visible ? (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17.94 17.94A10.94 10.94 0 0112 20C7 20 2.73 16.11 1 12c.75-1.79 1.93-3.37 3.4-4.6M9.9 4.24A9.12 9.12 0 0112 4c5 0 9.27 3.89 11 8a11.05 11.05 0 01-1.97 3.15M3 3l18 18" />
            </svg>
          ) : (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M1 12C2.73 7.89 7 4 12 4s9.27 3.89 11 8c-1.73 4.11-6 8-11 8S2.73 16.11 1 12z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()
  const [pageState, setPageState] = useState<PageState>('loading')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    timeoutRef.current = setTimeout(() => {
      setPageState(prev => (prev === 'loading' ? 'invalid' : prev))
    }, 4000)

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(event => {
      if (event === 'PASSWORD_RECOVERY') {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        setPageState('ready')
      }
    })

    return () => {
      subscription.unsubscribe()
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setPageState('success')
      setTimeout(() => router.push('/'), 1500)
    }
  }

  return (
    <div>
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Split-It</h1>
        <p className="mt-2 text-sm text-slate-500">Set a new password</p>
      </div>

      <div className="rounded-2xl bg-white px-6 py-8 shadow-sm ring-1 ring-slate-200">
        {/* ── Loading ── */}
        {pageState === 'loading' && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <svg
              className="h-6 w-6 animate-spin text-teal-600"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
            <p className="text-sm text-slate-500">Verifying reset link…</p>
          </div>
        )}

        {/* ── Invalid / expired ── */}
        {pageState === 'invalid' && (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="9" stroke="#dc2626" strokeWidth="1.5" />
                <path
                  d="M15 9l-6 6M9 9l6 6"
                  stroke="#dc2626"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-slate-900">Link invalid or expired</h2>
            <p className="mt-2 text-sm text-slate-500">
              This link is invalid or has expired. Please request a new password reset.
            </p>
            <Link
              href="/forgot-password"
              className="mt-4 inline-block text-sm font-medium text-teal-600 hover:text-teal-700"
            >
              Request a new reset link
            </Link>
            <div className="mt-3">
              <Link
                href="/login"
                className="text-sm text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline"
              >
                Back to log in
              </Link>
            </div>
          </div>
        )}

        {/* ── Password form ── */}
        {pageState === 'ready' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Choose a new password</h2>
              <p className="mt-1.5 text-sm text-slate-500">
                Your new password must be at least 8 characters.
              </p>
            </div>

            <PasswordInput
              id="new-password"
              label="New password"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              placeholder="At least 8 characters"
            />

            <PasswordInput
              id="confirm-password"
              label="Confirm password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
            />

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !password || !confirmPassword}
              className="w-full rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Updating…' : 'Update password'}
            </button>
          </form>
        )}

        {/* ── Success ── */}
        {pageState === 'success' && (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="9" stroke="#16a34a" strokeWidth="1.5" />
                <path
                  d="M8 12l3 3 5-5"
                  stroke="#16a34a"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-slate-900">Password updated</h2>
            <p className="mt-2 text-sm text-slate-500">Password updated — redirecting…</p>
          </div>
        )}
      </div>
    </div>
  )
}
