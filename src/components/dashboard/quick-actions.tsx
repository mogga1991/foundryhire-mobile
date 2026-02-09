'use client'

import Link from 'next/link'
import { Briefcase, UserPlus, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function QuickActions() {
  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
      <Button
        variant="outline"
        className="h-auto flex-col gap-2 py-4 px-3"
        asChild
      >
        <Link href="/jobs/new" className="flex flex-col items-center w-full">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950/50 shrink-0">
            <Briefcase className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-sm font-medium">New Job</div>
          <div className="text-xs text-muted-foreground">Post opening</div>
        </Link>
      </Button>

      <Button
        variant="outline"
        className="h-auto flex-col gap-2 py-4 px-3"
        asChild
      >
        <Link href="/candidates" className="flex flex-col items-center w-full">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/50 shrink-0">
            <UserPlus className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-sm font-medium">Candidate</div>
          <div className="text-xs text-muted-foreground">Add talent</div>
        </Link>
      </Button>

      <Button
        variant="outline"
        className="h-auto flex-col gap-2 py-4 px-3"
        asChild
      >
        <Link href="/campaigns" className="flex flex-col items-center w-full">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 dark:bg-purple-950/50 shrink-0">
            <Send className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="text-sm font-medium">Campaign</div>
          <div className="text-xs text-muted-foreground">Send emails</div>
        </Link>
      </Button>
    </div>
  )
}
