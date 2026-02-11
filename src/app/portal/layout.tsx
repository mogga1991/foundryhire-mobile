import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Candidate Portal - VerticalHire',
  description: 'Manage your job applications and profile',
}

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-orange-600 focus:text-white focus:font-semibold"
      >
        Skip to main content
      </a>
      <main id="main-content" className="w-full">
        {children}
      </main>
    </div>
  )
}
