import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Tables } from '@/types/database'
import { SplitList } from '../SplitList'

type SplitWithCount = Tables<'splits'> & { attendees: [{ count: number }] | [] }

export default async function SplitsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: splits } = await supabase
    .from('splits')
    .select('*, attendees(count)')
    .eq('organiser_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="flex min-h-screen flex-col pb-24">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 pb-4 safe-top">
        <h1 className="text-xl font-bold tracking-tight text-gwfc-blue">Splits</h1>
      </header>

      <main className="flex-1 px-4 py-5">
        <SplitList initialSplits={(splits ?? []) as unknown as SplitWithCount[]} />
      </main>
    </div>
  )
}
