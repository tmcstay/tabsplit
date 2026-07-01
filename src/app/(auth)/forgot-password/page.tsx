'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSent(true)
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Split-It</h1>
        <p className="mt-2 text-sm text-slate-500">Reset your password</p>
      </div>

      <div className="rounded-2xl bg-white px-6 py-8 shadow-sm ring-1 ring-slate-200">
        {sent ? (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M3 8l9 6 9-6" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <rect x="3" y="6" width="18" height="13" rx="2" stroke="#16a34a" strokeWidth="1.5" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-slate-900">Check your inbox</h2>
            <p className="mt-2 text-sm text-slate-500">
              If an account exists for{' '}
              <span className="font-medium text-slate-700">{email}</span>, we&apos;ve sent a
              password reset link. Check your spam folder if you don&apos;t see it.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-block text-sm text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline"
            >
              Back to log in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Forgot your password?</h2>
              <p className="mt-1.5 text-sm text-slate-500">
                Enter your email address and we&apos;ll send you a reset link.
              </p>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                Email address
              </label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
                className="mt-1.5 w-full rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm ring-1 ring-slate-300 outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Sending…' : 'Send reset link'}
            </button>

            <div className="text-center">
              <Link
                href="/login"
                className="text-sm text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline"
              >
                Back to log in
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
