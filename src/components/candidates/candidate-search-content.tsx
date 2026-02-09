'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, MapPin, Briefcase, Calendar, Award, Mail, ExternalLink } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Candidate {
  id: string
  firstName: string
  lastName: string
  email: string
  profileImageUrl: string | null
  location: string | null
  currentTitle: string | null
  currentCompany: string | null
  experienceYears: number | null
  skills: string[] | null
  bio: string | null
  resumeUrl: string | null
  createdAt: string
}

export function CandidateSearchContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '')
  const [locationFilter, setLocationFilter] = useState(searchParams.get('location') || '')
  const [experienceFilter, setExperienceFilter] = useState(searchParams.get('experience') || 'all')

  useEffect(() => {
    fetchCandidates()
  }, [searchParams])

  async function fetchCandidates() {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchQuery) params.set('q', searchQuery)
      if (locationFilter) params.set('location', locationFilter)
      if (experienceFilter && experienceFilter !== 'all') params.set('experience', experienceFilter)

      const res = await fetch(`/api/candidates/search?${params.toString()}`)
      const data = await res.json()

      if (res.ok) {
        setCandidates(data.candidates || [])
      }
    } catch (error) {
      console.error('Failed to fetch candidates:', error)
    } finally {
      setIsLoading(false)
    }
  }

  function handleSearch() {
    const params = new URLSearchParams()
    if (searchQuery) params.set('q', searchQuery)
    if (locationFilter) params.set('location', locationFilter)
    if (experienceFilter && experienceFilter !== 'all') params.set('experience', experienceFilter)

    router.push(`/find-candidates?${params.toString()}`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-purple-900 via-slate-900 to-cyan-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold mb-4">Find Construction Candidates</h1>
          <p className="text-lg text-gray-200 mb-8">
            Discover qualified professionals ready for their next opportunity
          </p>

          {/* Search Filters */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search by skills, title, or name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-10 h-12 text-gray-900"
                  />
                </div>
              </div>

              <div>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
                  <Input
                    type="text"
                    placeholder="Location"
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-10 h-12 text-gray-900"
                  />
                </div>
              </div>

              <div>
                <Select value={experienceFilter} onValueChange={setExperienceFilter}>
                  <SelectTrigger className="h-12 text-gray-900">
                    <SelectValue placeholder="Experience" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Experience</SelectItem>
                    <SelectItem value="0-2">0-2 years</SelectItem>
                    <SelectItem value="3-5">3-5 years</SelectItem>
                    <SelectItem value="6-10">6-10 years</SelectItem>
                    <SelectItem value="10+">10+ years</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-4">
              <Button
                onClick={handleSearch}
                className="w-full md:w-auto bg-purple-600 hover:bg-purple-700"
                size="lg"
              >
                <Search className="h-4 w-4 mr-2" />
                Search Candidates
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Loading candidates...</p>
          </div>
        ) : candidates.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 mb-4">No candidates found matching your criteria.</p>
            <Button variant="outline" onClick={() => {
              setSearchQuery('')
              setLocationFilter('')
              setExperienceFilter('all')
              router.push('/find-candidates')
            }}>
              Clear Filters
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <p className="text-gray-600">
                Found <span className="font-semibold text-gray-900">{candidates.length}</span> candidate{candidates.length !== 1 ? 's' : ''}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {candidates.map((candidate) => (
                <CandidateCard key={candidate.id} candidate={candidate} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function CandidateCard({ candidate }: { candidate: Candidate }) {
  const initials = `${candidate.firstName[0]}${candidate.lastName[0]}`.toUpperCase()

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start gap-6">
          {/* Avatar */}
          <Avatar className="h-20 w-20 border-2 border-gray-200">
            <AvatarImage src={candidate.profileImageUrl || undefined} alt={candidate.firstName} />
            <AvatarFallback className="bg-purple-100 text-purple-900 text-xl">
              {initials}
            </AvatarFallback>
          </Avatar>

          {/* Content */}
          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {candidate.firstName} {candidate.lastName}
                </h3>
                {candidate.currentTitle && (
                  <p className="text-gray-600 mt-1 flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    {candidate.currentTitle}
                    {candidate.currentCompany && ` at ${candidate.currentCompany}`}
                  </p>
                )}
              </div>

              <Button
                onClick={() => window.location.href = `/find-candidates/${candidate.id}`}
                variant="default"
                className="bg-purple-600 hover:bg-purple-700"
              >
                View Profile
              </Button>
            </div>

            {/* Details */}
            <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-600">
              {candidate.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {candidate.location}
                </div>
              )}
              {candidate.experienceYears !== null && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {candidate.experienceYears} years experience
                </div>
              )}
              {candidate.resumeUrl && (
                <a
                  href={candidate.resumeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-purple-600 hover:text-purple-700"
                >
                  <ExternalLink className="h-4 w-4" />
                  View Resume
                </a>
              )}
            </div>

            {/* Bio */}
            {candidate.bio && (
              <p className="mt-4 text-gray-700 line-clamp-2">
                {candidate.bio}
              </p>
            )}

            {/* Skills */}
            {candidate.skills && candidate.skills.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {candidate.skills.slice(0, 6).map((skill, index) => (
                  <Badge key={index} variant="secondary" className="bg-purple-100 text-purple-900">
                    {skill}
                  </Badge>
                ))}
                {candidate.skills.length > 6 && (
                  <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                    +{candidate.skills.length - 6} more
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
