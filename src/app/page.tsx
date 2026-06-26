import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SplitListWithState, type SplitWithCount } from './SplitList'
type OpenSplitWithItems = { id: string; items: Array<{ price: number }> | null }

const commitSha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: openSplitsRaw }, { data: splits }] = await Promise.all([
    supabase
      .from('splits')
      .select('id, items(price)')
      .eq('organiser_id', user.id)
      .in('status', ['pending', 'draft', 'finalised']),
    supabase
      .from('splits')
      .select('*, attendees(paid)')
      .eq('organiser_id', user.id)
      .in('status', ['pending', 'draft', 'finalised'])
      .order('created_at', { ascending: false }),
  ])

  const openSplits = (openSplitsRaw ?? []) as unknown as OpenSplitWithItems[]
  const openCount = openSplits.length

  const allSplits = (splits ?? []) as unknown as SplitWithCount[]
  const activeSplits = allSplits.filter(
    s => s.status === 'pending' || s.status === 'draft' ||
      (s.status === 'finalised' && !(s.attendees.length > 0 && s.attendees.every(a => a.paid)))
  )
  const owedTotal = openSplits.reduce((total, s) => {
    return total + (s.items ?? []).reduce((sum, item) => sum + Number(item.price), 0)
  }, 0)

  const formattedTotal = new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
  }).format(owedTotal)

  return (
    <div className="flex min-h-screen flex-col pb-32">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 pb-4 safe-top">
        <h1 className="text-xl font-bold tracking-tight text-gwfc-blue">TabSplit</h1>
        {commitSha && (
          <p className="font-mono text-[10px] text-slate-300">{commitSha}</p>
        )}
      </header>

      <main className="flex-1 space-y-6 py-5">
        {/* Hero: You're Owed card */}
        {openCount === 0 ? (
          <div
            className="mx-4 rounded-2xl px-5 py-6 text-white"
            style={{ background: 'linear-gradient(135deg, #425197, #1079bf)' }}
          >
            <div className="flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"
                stroke="white" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <p className="text-base font-semibold">All settled up</p>
            </div>
            <p className="mt-1 text-sm opacity-70">No outstanding amounts</p>
          </div>
        ) : (
          <div
            className="mx-4 rounded-2xl px-5 py-6 text-white"
            style={{ background: 'linear-gradient(135deg, #425197, #1079bf)' }}
          >
            <p className="text-xs font-semibold uppercase tracking-wider opacity-80">You&apos;re Owed</p>
            <p className="mt-1 text-4xl font-bold">{formattedTotal}</p>
            <p className="mt-1 text-sm opacity-70">
              across {openCount} open {openCount === 1 ? 'split' : 'splits'}
            </p>
          </div>
        )}

        {/* Recent Splits */}
        <section className="px-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Recent Splits
          </h2>
          <SplitListWithState initialSplits={activeSplits} />
        </section>
      </main>
    </div>
  )
}
