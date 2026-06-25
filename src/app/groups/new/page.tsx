import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NewGroupForm } from './NewGroupForm'

export default async function NewGroupPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: favourites } = await supabase
    .from('favourite_contacts')
    .select('id, display_name, phone, email')
    .eq('user_id', user.id)
    .order('display_name', { ascending: true })

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 pb-4 safe-top">
        <h1 className="text-xl font-bold tracking-tight text-gwfc-blue">New Group</h1>
      </header>
      <main className="flex-1 px-4 py-6 pb-32">
        <NewGroupForm userId={user.id} favourites={favourites ?? []} />
      </main>
    </div>
  )
}
