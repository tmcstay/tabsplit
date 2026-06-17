import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SignOutButton } from './SignOutButton'

export default async function ProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="flex min-h-screen flex-col pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white px-4 py-4">
        <h1 className="text-xl font-bold tracking-tight text-zinc-900">Profile</h1>
      </header>

      <main className="flex-1 px-4 py-6 space-y-4">
        {/* Account details */}
        <div className="rounded-2xl bg-white px-4 py-4 shadow-sm ring-1 ring-zinc-200">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
            Account
          </p>
          <p className="mt-2 text-sm font-medium text-zinc-900">{user.email}</p>
        </div>

        {/* Sign out */}
        <SignOutButton />
      </main>
    </div>
  )
}
