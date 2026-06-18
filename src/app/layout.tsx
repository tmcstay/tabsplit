import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import { BottomNav } from './_components/BottomNav'

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
  themeColor: '#18181b',
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
      <body className="h-full overflow-y-auto overscroll-none bg-zinc-50 font-sans text-zinc-900">
        {children}
        <BottomNav />
        <Script id="eruda" strategy="afterInteractive">{`
          if (window.location.hostname !== 'localhost' || window.location.hostname.includes('vercel.app')) {
            var s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/eruda';
            s.onload = function() { eruda.init(); };
            document.head.appendChild(s);
          }
        `}</Script>
      </body>
    </html>
  )
}
