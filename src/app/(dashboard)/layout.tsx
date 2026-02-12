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

  const sidebarUser = {
    id: session?.user.id ?? 'guest',
    email: session?.user.email ?? 'guest@verticalhire.local',
    full_name: session?.user.name ?? 'Guest',
    avatar_url: session?.user.image ?? null,
  }

  const companyName = session?.user.name ?? 'VerticalHire'

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
