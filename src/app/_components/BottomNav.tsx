'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const GWFC_GREEN = '#1caebb'
const GWFC_LIGHT_BLUE = '#1079bf'
const INACTIVE = '#94a3b8'

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"
      stroke={active ? GWFC_GREEN : INACTIVE} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
      <path d="M9 21V12h6v9" />
    </svg>
  )
}

function GroupsIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"
      stroke={active ? GWFC_GREEN : INACTIVE} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="7" r="3.5" />
      <path d="M2 20c0-3.3 3.1-6 7-6s7 2.7 7 6" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M22 20c0-2.2-1.8-4-4-4" />
    </svg>
  )
}

function SplitsIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"
      stroke={active ? GWFC_GREEN : INACTIVE} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <path d="M9 7h6M9 11h6M9 15h4" />
    </svg>
  )
}

function ProfileIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"
      stroke={active ? GWFC_GREEN : INACTIVE} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="3.75" />
      <path d="M4.5 20.118a7.5 7.5 0 0115 0" />
    </svg>
  )
}

const AUTH_PATHS = ['/login', '/callback', '/forgot-password', '/reset-password']

export function BottomNav() {
  const pathname = usePathname()

  if (AUTH_PATHS.some(p => pathname === p || pathname.startsWith(`${p}/`))) {
    return null
  }

  const isHome = pathname === '/'
  const isGroups = pathname.startsWith('/groups')
  const isSplits = pathname.startsWith('/splits') && !pathname.startsWith('/splits/new')
  const isProfile = pathname.startsWith('/profile')

  function labelCls(active: boolean) {
    return `text-xs font-medium transition-colors ${active ? 'text-gwfc-green' : 'text-slate-400'}`
  }

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 border-t border-slate-200 bg-white"
      style={{ overflow: 'visible', paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}
    >
      <div className="relative flex h-[68px] items-center" style={{ overflow: 'visible' }}>
        {/* Home */}
        <Link href="/" className="flex flex-1 flex-col items-center gap-0.5 py-3">
          <HomeIcon active={isHome} />
          <span className={labelCls(isHome)}>Home</span>
        </Link>

        {/* Groups */}
        <Link href="/groups" className="flex flex-1 flex-col items-center gap-0.5 py-3">
          <GroupsIcon active={isGroups} />
          <span className={labelCls(isGroups)}>Groups</span>
        </Link>

        {/* New Split — raised centre button */}
        <div className="relative flex flex-1 flex-col items-center">
          <Link
            href="/splits/new"
            aria-label="New Split"
            className="absolute flex items-center justify-center rounded-full"
            style={{
              width: 50,
              height: 50,
              top: -30,
              background: `linear-gradient(135deg, ${GWFC_GREEN}, ${GWFC_LIGHT_BLUE})`,
              boxShadow: '0 4px 14px rgba(28, 174, 187, 0.45)',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"
              stroke="white" strokeWidth="2.25" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </Link>
        </div>

        {/* Splits */}
        <Link href="/splits" className="flex flex-1 flex-col items-center gap-0.5 py-3">
          <SplitsIcon active={isSplits} />
          <span className={labelCls(isSplits)}>Splits</span>
        </Link>

        {/* Profile */}
        <Link href="/profile" className="flex flex-1 flex-col items-center gap-0.5 py-3">
          <ProfileIcon active={isProfile} />
          <span className={labelCls(isProfile)}>Profile</span>
        </Link>
      </div>
    </nav>
  )
}
