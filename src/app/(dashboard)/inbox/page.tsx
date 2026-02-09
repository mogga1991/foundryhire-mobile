import type { Metadata } from 'next'
import { Inbox as InboxIcon } from 'lucide-react'
import { EmployerInboxList } from '@/components/employer/employer-inbox-list'

export const metadata: Metadata = {
  title: 'Inbox - VerticalHire',
  description: 'Track your candidate reach-outs and responses',
}

export default function InboxPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 shadow-lg">
          <InboxIcon className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Inbox</h1>
          <p className="text-gray-600">
            Track your candidate reach-outs and responses
          </p>
        </div>
      </div>

      {/* Inbox List */}
      <EmployerInboxList />
    </div>
  )
}
