import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LoginForm } from './LoginForm'

export default async function LoginPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) redirect('/')

  return (
    <div>
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">TabSplit</h1>
        <p className="mt-2 text-sm text-zinc-500">Split the bill, keep the peace.</p>
      </div>

      <div className="rounded-2xl bg-white px-6 py-8 shadow-sm ring-1 ring-zinc-200">
        <LoginForm />
      </div>
    </div>
  )
}
