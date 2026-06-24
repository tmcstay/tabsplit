import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SignOutButton } from './SignOutButton'
import { PayIdForm } from './PayIdForm'

export default async function ProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('payid, payid_label')
    .eq('id', user.id)
    .single()

  return (
    <div className="flex min-h-screen flex-col pb-32">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 pb-4 safe-top">
        <h1 className="text-xl font-bold tracking-tight text-gwfc-blue">Profile</h1>
      </header>

      <main className="flex-1 px-4 py-6 space-y-4">
        {/* Account details */}
        <div className="rounded-2xl bg-white px-4 py-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Account
          </p>
          <p className="mt-2 text-sm font-medium text-gwfc-blue">{user.email}</p>
        </div>

        {/* Payment details */}
        <PayIdForm
          initialPayid={profile?.payid ?? null}
          initialPayidLabel={profile?.payid_label ?? null}
        />

        {/* Sign out */}
        <SignOutButton />
      </main>
    </div>
  )
}
