'use client'

import { useState, useEffect } from 'react'
import { Mail, MailOpen, MapPin, Briefcase, Calendar, User, Phone, ExternalLink } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'

interface ReachOut {
  id: string
  message: string
  status: string
  createdAt: string
  readAt: string | null
  candidate: {
    id: string
    firstName: string
    lastName: string
    email: string
    phone: string | null
    profileImageUrl: string | null
    currentTitle: string | null
    currentCompany: string | null
    location: string | null
  }
}

export function EmployerInboxList() {
  const [reachOuts, setReachOuts] = useState<ReachOut[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all')

  useEffect(() => {
    fetchReachOuts()
  }, [])

  async function fetchReachOuts() {
    setIsLoading(true)
    try {
      const res = await fetch('/api/employer/reach-outs')
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

  const filteredReachOuts = reachOuts.filter(ro => {
    if (filter === 'unread') return ro.status === 'sent'
    if (filter === 'read') return ro.status === 'read'
    return true
  })

  const unreadCount = reachOuts.filter(ro => ro.status === 'sent').length

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Loading inbox...</p>
      </div>
    )
  }

  if (reachOuts.length === 0) {
    return (
      <Card className="border-purple-200">
        <CardContent className="p-12 text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-purple-100 mb-4">
            <Mail className="h-8 w-8 text-purple-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No messages sent yet
          </h3>
          <p className="text-gray-600 mb-6">
            When you reach out to candidates, you'll see them here.
          </p>
          <Button asChild className="bg-purple-600 hover:bg-purple-700">
            <Link href="/candidates">
              Find Candidates
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filter Tabs */}
      <div className="flex items-center gap-4">
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          onClick={() => setFilter('all')}
          className={filter === 'all' ? 'bg-purple-600 hover:bg-purple-700' : ''}
          size="sm"
        >
          All ({reachOuts.length})
        </Button>
        <Button
          variant={filter === 'unread' ? 'default' : 'outline'}
          onClick={() => setFilter('unread')}
          className={filter === 'unread' ? 'bg-purple-600 hover:bg-purple-700' : ''}
          size="sm"
        >
          Awaiting Response ({unreadCount})
        </Button>
        <Button
          variant={filter === 'read' ? 'default' : 'outline'}
          onClick={() => setFilter('read')}
          className={filter === 'read' ? 'bg-purple-600 hover:bg-purple-700' : ''}
          size="sm"
        >
          Read ({reachOuts.length - unreadCount})
        </Button>
      </div>

      {/* Reach-outs List */}
      <div className="space-y-4">
        {filteredReachOuts.length === 0 ? (
          <Card className="border-gray-200">
            <CardContent className="p-8 text-center">
              <p className="text-gray-600">No messages in this category</p>
            </CardContent>
          </Card>
        ) : (
          filteredReachOuts.map((reachOut) => {
            const initials = `${reachOut.candidate.firstName[0]}${reachOut.candidate.lastName[0] || ''}`.toUpperCase()

            return (
              <Card
                key={reachOut.id}
                className={`border-purple-200 transition-all hover:shadow-md ${
                  reachOut.status === 'sent'
                    ? 'bg-purple-50 border-l-4 border-l-purple-600'
                    : 'bg-white'
                }`}
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <Avatar className="h-12 w-12 border-2 border-purple-200">
                      <AvatarImage
                        src={reachOut.candidate.profileImageUrl || undefined}
                        alt={reachOut.candidate.firstName}
                      />
                      <AvatarFallback className="bg-purple-100 text-purple-700">
                        {initials}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-900">
                              {reachOut.candidate.firstName} {reachOut.candidate.lastName}
                            </h3>
                            {reachOut.status === 'sent' ? (
                              <Badge variant="default" className="bg-purple-600">
                                Awaiting Response
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-green-600 text-green-700">
                                <MailOpen className="h-3 w-3 mr-1" />
                                Read
                              </Badge>
                            )}
                          </div>

                          {/* Candidate Info */}
                          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                            {reachOut.candidate.currentTitle && (
                              <span className="flex items-center gap-1">
                                <Briefcase className="h-3.5 w-3.5" />
                                {reachOut.candidate.currentTitle}
                                {reachOut.candidate.currentCompany && ` at ${reachOut.candidate.currentCompany}`}
                              </span>
                            )}
                            {reachOut.candidate.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5" />
                                {reachOut.candidate.location}
                              </span>
                            )}
                          </div>
                        </div>

                        <span className="text-xs text-gray-500 flex items-center gap-1 whitespace-nowrap">
                          <Calendar className="h-3 w-3" />
                          {formatDistanceToNow(new Date(reachOut.createdAt), { addSuffix: true })}
                        </span>
                      </div>

                      {/* Message */}
                      <div className="bg-white p-4 rounded-lg border border-purple-100 mb-4">
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                          {reachOut.message}
                        </p>
                      </div>

                      {/* Status Info */}
                      {reachOut.readAt && (
                        <p className="text-xs text-gray-500 mb-3">
                          Read {formatDistanceToNow(new Date(reachOut.readAt), { addSuffix: true })}
                        </p>
                      )}

                      {/* Actions */}
                      <div className="flex gap-3">
                        <Button
                          asChild
                          variant="default"
                          className="bg-purple-600 hover:bg-purple-700"
                          size="sm"
                        >
                          <Link href={`/candidates/${reachOut.candidate.id}`}>
                            <User className="h-4 w-4 mr-1" />
                            View Profile
                          </Link>
                        </Button>

                        <Button
                          asChild
                          variant="outline"
                          className="border-purple-200"
                          size="sm"
                        >
                          <a href={`mailto:${reachOut.candidate.email}`}>
                            <Mail className="h-4 w-4 mr-1" />
                            Email Candidate
                          </a>
                        </Button>

                        {reachOut.candidate.phone && (
                          <Button
                            asChild
                            variant="outline"
                            className="border-purple-200"
                            size="sm"
                          >
                            <a href={`tel:${reachOut.candidate.phone}`}>
                              <Phone className="h-4 w-4 mr-1" />
                              Call
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
