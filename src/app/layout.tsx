import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#f97316',
}

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || 'https://verticalhire.com'
  ),
  title: 'VerticalHire - AI-Powered Construction Recruiting',
  description:
    'Hire construction executives without recruiters. VerticalHire uses AI to source, score, and engage top construction talent automatically.',
  manifest: '/manifest.json',
  keywords: [
    'construction recruiting',
    'AI hiring',
    'construction executives',
    'talent sourcing',
    'recruitment automation',
  ],
  openGraph: {
    title: 'VerticalHire - AI-Powered Construction Recruiting',
    description:
      'Hire construction executives without recruiters. AI-powered sourcing, scoring, and outreach.',
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'VerticalHire - AI-Powered Construction Recruiting Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VerticalHire - AI-Powered Construction Recruiting',
    description:
      'Hire construction executives without recruiters. AI-powered sourcing, scoring, and outreach.',
    images: ['/og-image.png'],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
