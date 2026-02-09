'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Building2, CreditCard, User, Mail } from 'lucide-react'

const settingsNav = [
  {
    title: 'Profile',
    href: '/settings',
    icon: User,
    description: 'Manage your personal account settings',
  },
  {
    title: 'Company',
    href: '/settings/company',
    icon: Building2,
    description: 'Company profile and team management',
  },
  {
    title: 'Email',
    href: '/settings/email',
    icon: Mail,
    description: 'Email accounts and domain verification',
  },
  {
    title: 'Billing',
    href: '/settings/billing',
    icon: CreditCard,
    description: 'Subscription and billing information',
  },
]

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your account settings and preferences.
        </p>
      </div>

      <div className="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
        <aside className="lg:w-1/5">
          <nav className="flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1">
            {settingsNav.map((item) => {
              const isActive = pathname === item.href
              const Icon = item.icon

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'inline-flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
                    isActive
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="hidden lg:inline">{item.title}</span>
                </Link>
              )
            })}
          </nav>
        </aside>
        <div className="flex-1 max-w-4xl">{children}</div>
      </div>
    </div>
  )
}
