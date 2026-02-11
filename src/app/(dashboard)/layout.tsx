import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { Sidebar } from '@/components/layout/sidebar'
import { Navbar } from '@/components/layout/navbar'
import { DashboardHeader } from '@/components/layout/dashboard-header'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  const { user } = session

  const sidebarUser = {
    id: user.id,
    email: user.email,
    full_name: user.name ?? user.email,
    avatar_url: user.image,
  }

  const companyName = user.name ?? 'VerticalHire'

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex">
        <Sidebar user={sidebarUser} companyName={companyName} />
      </aside>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile navbar */}
        <Navbar user={sidebarUser} companyName={companyName} />

        {/* Desktop header with notifications */}
        <DashboardHeader />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
