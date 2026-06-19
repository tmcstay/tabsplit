'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"
      stroke={active ? '#0d9488' : '#94a3b8'} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12l9-9 9 9" />
      <path d="M9 21V12h6v9" />
      <rect x="3" y="11" width="18" height="10" rx="1" fill="none" />
      <path d="M2.25 12l8.954-8.955a1.125 1.125 0 011.591 0L21.75 12" />
      <path d="M4.5 10.5V20.25A.75.75 0 005.25 21H9v-4.5h6V21h3.75a.75.75 0 00.75-.75V10.5" />
    </svg>
  )
}

function ProfileIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"
      stroke={active ? '#0d9488' : '#94a3b8'} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="3.75" />
      <path d="M4.5 20.118a7.5 7.5 0 0115 0" />
    </svg>
  )
}

const AUTH_PATHS = ['/login', '/callback']

export function BottomNav() {
  const pathname = usePathname()

  if (AUTH_PATHS.some(p => pathname === p || pathname.startsWith(`${p}/`))) {
    return null
  }

  const isHome = pathname === '/'
  const isProfile = pathname.startsWith('/profile')

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-slate-200 bg-white">
      <div className="flex h-16 items-center">
        <Link
          href="/"
          className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors ${
            isHome ? 'text-teal-600' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <HomeIcon active={isHome} />
          <span>Home</span>
        </Link>
        <Link
          href="/profile"
          className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors ${
            isProfile ? 'text-teal-600' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <ProfileIcon active={isProfile} />
          <span>Profile</span>
        </Link>
      </div>
    </nav>
  )
}
