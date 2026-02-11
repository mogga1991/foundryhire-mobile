'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { LogOut, User, Settings, ChevronDown, Bell } from 'lucide-react'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

interface CandidateNavProps {
  user: {
    id: string
    firstName: string
    lastName: string
    email: string
    profileImageUrl: string | null
  }
}

export function CandidateNav({ user }: CandidateNavProps) {
  const router = useRouter()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const initials = `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()

  async function handleLogout() {
    setIsLoggingOut(true)
    try {
      const res = await fetch('/api/portal/auth/logout', {
        method: 'POST',
      })

      if (!res.ok) {
        throw new Error('Logout failed')
      }

      toast.success('Logged out successfully')
      router.push('/portal/login')
      router.refresh()
    } catch (error) {
      console.error('Logout error:', error)
      toast.error('Failed to logout', {
        description: 'Please try again',
      })
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <header className="bg-gradient-to-r from-orange-600 to-orange-700 text-white shadow-lg" role="banner">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4" aria-label="Main navigation">
        <div className="flex items-center justify-between">
          {/* Logo and Title */}
          <Link href="/portal/dashboard" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center">
              <Image
                src="/verticalhire.png"
                alt="VerticalHire"
                width={40}
                height={40}
                className="object-contain"
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold">VerticalHire</h1>
              <p className="text-xs text-orange-100">Candidate Portal</p>
            </div>
          </Link>

          {/* User Menu */}
          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium">{user.firstName} {user.lastName}</p>
              <p className="text-xs text-orange-100">{user.email}</p>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-10 w-10 rounded-full hover:bg-orange-700"
                  aria-label="User menu"
                >
                  <Avatar className="h-10 w-10 border-2 border-white">
                    <AvatarImage src={user.profileImageUrl || undefined} alt={`${user.firstName} ${user.lastName} profile picture`} />
                    <AvatarFallback className="bg-orange-800 text-white">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <ChevronDown className="absolute -bottom-1 -right-1 h-4 w-4 bg-orange-600 rounded-full" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user.firstName} {user.lastName}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/portal/profile" className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" aria-hidden="true" />
                    <span>Profile</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/portal/notifications" className="cursor-pointer">
                    <Bell className="mr-2 h-4 w-4" aria-hidden="true" />
                    <span>Notifications</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/portal/settings" className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" aria-hidden="true" />
                    <span>Settings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-600 cursor-pointer"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  aria-label={isLoggingOut ? 'Logging out' : 'Log out of your account'}
                >
                  <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
                  <span>{isLoggingOut ? 'Logging out...' : 'Log out'}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </nav>
    </header>
  )
}
