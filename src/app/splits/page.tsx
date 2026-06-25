import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SplitsPageClient, type SplitWithPaid } from './SplitsPageClient'

export default async function SplitsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: splits } = await supabase
    .from('splits')
    .select('*, attendees(paid)')
    .eq('organiser_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="flex min-h-screen flex-col pb-32">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 pb-4 safe-top">
        <h1 className="text-xl font-bold tracking-tight text-gwfc-blue">Splits</h1>
      </header>
      <SplitsPageClient splits={(splits ?? []) as unknown as SplitWithPaid[]} />
    </div>
  )
}
