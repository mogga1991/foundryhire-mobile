'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Menu, Flame, LogOut, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { NotificationBell } from '@/components/notifications/notification-bell'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Sidebar } from '@/components/layout/sidebar'

interface NavbarUser {
  id: string
  email: string
  full_name: string
  avatar_url: string | null
}

interface NavbarProps {
  user: NavbarUser
  companyName: string
}

function getInitials(name: string): string {
  const parts = name.trim().split(' ')
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

export function Navbar({ user, companyName }: NavbarProps) {
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleSignOut() {
    router.push('/dashboard')
  }

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b border-slate-200 bg-white/80 px-4 backdrop-blur-sm lg:hidden">
      {/* Mobile menu */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle navigation menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[280px] max-w-[85vw] p-0" showCloseButton={false}>
          <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
          <Sidebar
            user={user}
            companyName={companyName}
            onMobileClose={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>

      {/* Logo */}
      <Link href="/dashboard" className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 shadow-md">
          <Flame className="h-4 w-4 text-white" />
        </div>
        <span className="text-base font-bold tracking-tight">VerticalHire</span>
      </Link>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Notifications */}
      <NotificationBell />

      {/* User dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full">
            <Avatar size="sm">
              {user.avatar_url && (
                <AvatarImage src={user.avatar_url} alt={user.full_name} />
              )}
              <AvatarFallback className="bg-gradient-to-br from-indigo-600 to-purple-600 text-xs text-white">
                {getInitials(user.full_name)}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
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
          <DropdownMenuItem onClick={handleSignOut} variant="destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
