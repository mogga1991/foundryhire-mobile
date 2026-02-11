'use client'

import { useState, useEffect } from 'react'
import { Mail, MailOpen, Building2, Calendar } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDistanceToNow } from 'date-fns'

interface ReachOut {
  id: string
  message: string
  status: string
  createdAt: string
  readAt: string | null
  employer: {
    name: string
    email: string
    image: string | null
  }
  company: {
    name: string
  } | null
}

export function CandidateNotificationsList({ candidateId }: { candidateId: string }) {
  const [reachOuts, setReachOuts] = useState<ReachOut[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchReachOuts()
  }, [])

  async function fetchReachOuts() {
    setIsLoading(true)
    try {
      const res = await fetch('/api/candidate/reach-outs')
      const data = await res.json()

      if (res.ok) {
        setReachOuts(data.reachOuts || [])
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Failed to fetch reach-outs:', error)
      }
    } finally {
      setIsLoading(false)
    }
  }

  async function markAsRead(reachOutId: string) {
    try {
      await fetch(`/api/candidate/reach-outs/${reachOutId}/read`, {
        method: 'POST',
      })

      // Update local state
      setReachOuts(prevReachOuts =>
        prevReachOuts.map(ro =>
          ro.id === reachOutId
            ? { ...ro, status: 'read', readAt: new Date().toISOString() }
            : ro
        )
      )
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Failed to mark as read:', error)
      }
    }
  }

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Loading notifications...</p>
      </div>
    )
  }

  if (reachOuts.length === 0) {
    return (
      <Card className="border-orange-200">
        <CardContent className="p-12 text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 mb-4">
            <Mail className="h-8 w-8 text-orange-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No notifications yet
          </h3>
          <p className="text-gray-600 mb-6">
            When employers reach out with opportunities, you'll see them here.
          </p>
          <p className="text-sm text-gray-500">
            Make sure your profile is complete to increase your chances of being discovered!
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-600">
          {reachOuts.filter(ro => ro.status === 'sent').length} unread message
          {reachOuts.filter(ro => ro.status === 'sent').length !== 1 ? 's' : ''}
        </p>
      </div>

      {reachOuts.map((reachOut) => (
        <Card
          key={reachOut.id}
          className={`border-orange-200 transition-all ${
            reachOut.status === 'sent'
              ? 'bg-orange-50 border-l-4 border-l-orange-600'
              : 'bg-white'
          }`}
        >
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                {reachOut.status === 'sent' ? (
                  <Mail className="h-6 w-6 text-orange-600" />
                ) : (
                  <MailOpen className="h-6 w-6 text-gray-400" />
                )}
              </div>

              <div className="flex-1">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      {reachOut.employer.name}
                      {reachOut.status === 'sent' && (
                        <Badge variant="default" className="bg-orange-600">
                          New
                        </Badge>
                      )}
                    </h3>
                    {reachOut.company && (
                      <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                        <Building2 className="h-3 w-3" />
                        {reachOut.company.name}
                      </p>
                    )}
                  </div>

                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDistanceToNow(new Date(reachOut.createdAt), { addSuffix: true })}
                  </span>
                </div>

                <div className="bg-white p-4 rounded-lg border border-orange-100 mb-4">
                  <p className="text-gray-700 whitespace-pre-wrap">{reachOut.message}</p>
                </div>

                <div className="flex gap-3">
                  <Button
                    asChild
                    variant="default"
                    className="bg-orange-600 hover:bg-orange-700"
                    size="sm"
                  >
                    <a href={`mailto:${reachOut.employer.email}`}>
                      Reply via Email
                    </a>
                  </Button>

                  {reachOut.status === 'sent' && (
                    <Button
                      onClick={() => markAsRead(reachOut.id)}
                      variant="outline"
                      className="border-orange-200"
                      size="sm"
                    >
                      Mark as Read
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
