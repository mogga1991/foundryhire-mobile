'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, MapPin, Briefcase, Calendar, Award, Mail, ExternalLink, Linkedin, Phone, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface Candidate {
  id: string
  firstName: string
  lastName: string
  email: string
  profileImageUrl: string | null
  phone: string | null
  location: string | null
  currentTitle: string | null
  currentCompany: string | null
  linkedinUrl: string | null
  experienceYears: number | null
  skills: string[] | null
  bio: string | null
  resumeUrl: string | null
  createdAt: Date
}

export function CandidateProfileView({ candidate }: { candidate: Candidate }) {
  const [isReachingOut, setIsReachingOut] = useState(false)
  const [message, setMessage] = useState('')
  const [showReachOutDialog, setShowReachOutDialog] = useState(false)

  const initials = `${candidate.firstName[0]}${candidate.lastName[0]}`.toUpperCase()

  async function handleReachOut() {
    if (!message.trim()) {
      toast.error('Please enter a message')
      return
    }

    setIsReachingOut(true)
    try {
      const res = await fetch('/api/candidates/reach-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId: candidate.id,
          message: message.trim(),
        }),
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || 'Failed to send message')
      }

      toast.success('Message sent!', {
        description: `${candidate.firstName} will be notified about your interest.`,
      })

      setMessage('')
      setShowReachOutDialog(false)
    } catch (error) {
      console.error('Reach out error:', error)
      toast.error('Failed to send message', {
        description: error instanceof Error ? error.message : 'Please try again',
      })
    } finally {
      setIsReachingOut(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900 via-slate-900 to-cyan-900 text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            href="/candidates"
            className="inline-flex items-center gap-2 text-white hover:text-gray-200 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Search
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Profile Header */}
            <Card>
              <CardContent className="p-8">
                <div className="flex items-start gap-6">
                  <Avatar className="h-32 w-32 border-4 border-white shadow-lg">
                    <AvatarImage src={candidate.profileImageUrl || undefined} alt={candidate.firstName} />
                    <AvatarFallback className="bg-purple-100 text-purple-900 text-3xl">
                      {initials}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1">
                    <h1 className="text-3xl font-bold text-gray-900">
                      {candidate.firstName} {candidate.lastName}
                    </h1>

                    {candidate.currentTitle && (
                      <p className="text-xl text-gray-600 mt-2 flex items-center gap-2">
                        <Briefcase className="h-5 w-5" />
                        {candidate.currentTitle}
                        {candidate.currentCompany && ` at ${candidate.currentCompany}`}
                      </p>
                    )}

                    <div className="mt-4 flex flex-wrap gap-4 text-gray-600">
                      {candidate.location && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          {candidate.location}
                        </div>
                      )}
                      {candidate.experienceYears !== null && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          {candidate.experienceYears} years experience
                        </div>
                      )}
                    </div>

                    <div className="mt-6 flex gap-3">
                      <Dialog open={showReachOutDialog} onOpenChange={setShowReachOutDialog}>
                        <DialogTrigger asChild>
                          <Button className="bg-purple-600 hover:bg-purple-700" size="lg">
                            <Send className="h-4 w-4 mr-2" />
                            Reach Out
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Reach Out to {candidate.firstName}</DialogTitle>
                            <DialogDescription>
                              Send a message to introduce your opportunity
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <Textarea
                              placeholder="Hi, I came across your profile and would love to discuss an opportunity..."
                              value={message}
                              onChange={(e) => setMessage(e.target.value)}
                              rows={6}
                              className="resize-none"
                            />
                            <Button
                              onClick={handleReachOut}
                              disabled={isReachingOut || !message.trim()}
                              className="w-full bg-purple-600 hover:bg-purple-700"
                            >
                              {isReachingOut ? 'Sending...' : 'Send Message'}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>

                      {candidate.resumeUrl && (
                        <Button
                          asChild
                          variant="outline"
                          size="lg"
                        >
                          <a href={candidate.resumeUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4 mr-2" />
                            View Resume
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* About */}
            {candidate.bio && (
              <Card>
                <CardHeader>
                  <CardTitle>About</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 whitespace-pre-wrap">{candidate.bio}</p>
                </CardContent>
              </Card>
            )}

            {/* Skills */}
            {candidate.skills && candidate.skills.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5" />
                    Skills & Expertise
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {candidate.skills.map((skill, index) => (
                      <Badge key={index} variant="secondary" className="bg-purple-100 text-purple-900 px-4 py-2 text-sm">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Contact Info */}
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3 text-gray-700">
                  <Mail className="h-5 w-5 text-gray-400" />
                  <a href={`mailto:${candidate.email}`} className="hover:text-purple-600">
                    {candidate.email}
                  </a>
                </div>

                {candidate.phone && (
                  <div className="flex items-center gap-3 text-gray-700">
                    <Phone className="h-5 w-5 text-gray-400" />
                    <a href={`tel:${candidate.phone}`} className="hover:text-purple-600">
                      {candidate.phone}
                    </a>
                  </div>
                )}

                {candidate.linkedinUrl && (
                  <div className="flex items-center gap-3 text-gray-700">
                    <Linkedin className="h-5 w-5 text-gray-400" />
                    <a
                      href={candidate.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-purple-600 flex items-center gap-1"
                    >
                      LinkedIn Profile
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600">Experience</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {candidate.experienceYears ? `${candidate.experienceYears} years` : 'Not specified'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Location</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {candidate.location || 'Not specified'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Skills</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {candidate.skills ? `${candidate.skills.length} listed` : 'Not specified'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
