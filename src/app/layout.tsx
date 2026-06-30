import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { BottomNav } from './_components/BottomNav'
import { ErudaInit } from '@/components/ErudaInit'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'TabSplit',
  description: 'Split the bill, keep the peace.',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en-AU"
      className={`${geistSans.variable} ${geistMono.variable} h-dvh antialiased`}
    >
      <body className="h-full overflow-y-auto overscroll-none bg-slate-50 font-sans text-gwfc-blue">
        {children}
        <BottomNav />
        <ErudaInit />
      </body>
    </html>
  )
}
