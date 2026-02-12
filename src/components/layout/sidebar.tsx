'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Briefcase,
  Users,
  Mail,
  Video,
  Settings,
  LogOut,
  ChevronLeft,
  Flame,
  Inbox,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

interface SidebarUser {
  id: string
  email: string
  full_name: string
  avatar_url: string | null
}

interface SidebarProps {
  user: SidebarUser
  companyName: string
  onMobileClose?: () => void
}

const navLinks = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Jobs',
    href: '/jobs',
    icon: Briefcase,
  },
  {
    label: 'Candidates',
    href: '/candidates',
    icon: Users,
  },
  {
    label: 'Inbox',
    href: '/inbox',
    icon: Inbox,
  },
  {
    label: 'Interviews',
    href: '/interviews',
    icon: Video,
  },
  {
    label: 'Campaigns',
    href: '/campaigns',
    icon: Mail,
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: Settings,
  },
]

function getInitials(name: string): string {
  const parts = name.trim().split(' ')
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

export function Sidebar({ user, companyName, onMobileClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    router.push('/dashboard')
  }

  return (
    <div className="flex h-full w-64 flex-col bg-gradient-to-b from-slate-900 to-slate-950 text-white">
      {/* Brand */}
      <div className="flex h-16 items-center gap-2 px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 shadow-lg">
          <Flame className="h-5 w-5 text-white" />
        </div>
        <span className="text-lg font-bold tracking-tight">VerticalHire</span>
        {onMobileClose && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="ml-auto text-slate-400 hover:bg-slate-800 hover:text-white"
            onClick={onMobileClose}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Company name */}
      <div className="px-6 pb-4">
        <p className="truncate text-xs font-medium text-slate-400">
          {companyName}
        </p>
      </div>

      <Separator className="bg-slate-700/50" />

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navLinks.map((link) => {
          const isActive =
            pathname === link.href || pathname.startsWith(link.href + '/')
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={onMobileClose}
              className={cn(
                'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                isActive
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
              )}
            >
              {isActive && (
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 opacity-20 blur" />
              )}
              <link.icon
                className={cn(
                  'relative h-5 w-5 shrink-0',
                  isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-300'
                )}
              />
              <span className="relative">{link.label}</span>
            </Link>
          )
        })}
      </nav>

      <Separator className="bg-slate-700/50" />

      {/* User section */}
      <div className="p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all hover:bg-slate-800/60">
              <Avatar size="sm">
                {user.avatar_url && (
                  <AvatarImage src={user.avatar_url} alt={user.full_name} />
                )}
                <AvatarFallback className="bg-gradient-to-br from-indigo-600 to-purple-600 text-xs text-white">
                  {getInitials(user.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left">
                <p className="truncate text-sm font-medium text-white">
                  {user.full_name}
                </p>
                <p className="truncate text-xs text-slate-400">{user.email}</p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align="start"
            className="w-56"
          >
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{user.full_name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleSignOut}
              variant="destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
