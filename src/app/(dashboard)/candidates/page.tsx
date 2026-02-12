import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Users,
  Search,
  Filter,
  SlidersHorizontal,
  Eye,
  Mail,
  Phone,
  Grid3x3,
  List,
  ChevronDown,
  Linkedin
} from 'lucide-react'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { candidates, companyUsers } from '@/lib/db/schema'
import { eq, desc, and, sql } from 'drizzle-orm'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { GenerateLeadsDialog } from '@/components/candidates/generate-leads-dialog'
import { CsvImportDialog } from '@/components/candidates/csv-import-dialog'
import { LeadPoolImportDialog } from '@/components/candidates/lead-pool-import-dialog'
import { EnrichmentStatus } from '@/components/candidates/enrichment-status'
import { DeleteCandidateButton } from '@/components/candidates/delete-candidate-button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export const metadata = {
  title: 'Candidates | VerticalHire',
  description: 'Manage and track your candidate pipeline',
}

export default async function CandidatesPage() {
  const session = await getSession({ allowGuest: true })

  if (!session) {
    redirect('/login')
  }

  const user = session.user

  // Get the user's company
  const [companyUser] = await db
    .select({ companyId: companyUsers.companyId })
    .from(companyUsers)
    .where(eq(companyUsers.userId, user.id))
    .limit(1)

  if (!companyUser) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Candidates</h1>
            <p className="text-muted-foreground mt-1">
              Manage and track your candidate pipeline
            </p>
          </div>
        </div>
        <div className="border rounded-lg p-16 text-center">
          <Users className="h-16 w-16 text-muted-foreground/50 mb-4 mx-auto" />
          <h3 className="text-lg font-semibold mb-2">No company set up yet</h3>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
            Set up your company profile in settings to start managing candidates.
          </p>
          <Link href="/settings/company">
            <Button>Go to Company Settings</Button>
          </Link>
        </div>
      </div>
    )
  }

  // Fetch all candidates for this company
  const candidatesList = await db
    .select({
      id: candidates.id,
      firstName: candidates.firstName,
      lastName: candidates.lastName,
      email: candidates.email,
      phone: candidates.phone,
      currentTitle: candidates.currentTitle,
      currentCompany: candidates.currentCompany,
      status: candidates.status,
      aiScore: candidates.aiScore,
      createdAt: candidates.createdAt,
      jobId: candidates.jobId,
      source: candidates.source,
      profileImageUrl: candidates.profileImageUrl,
      linkedinUrl: candidates.linkedinUrl,
      location: candidates.location,
    })
    .from(candidates)
    .where(eq(candidates.companyId, companyUser.companyId))
    .orderBy(desc(candidates.createdAt))
    .limit(100)

  const totalCandidates = candidatesList.length
  const highScoringCount = candidatesList.filter(c => (c.aiScore || 0) > 75).length
  const [recentCountResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(candidates)
    .where(
      and(
        eq(candidates.companyId, companyUser.companyId),
        sql`${candidates.createdAt} >= now() - interval '7 days'`
      )
    )

  const recentCount = recentCountResult?.count ?? 0

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Candidates</h1>
          <p className="text-muted-foreground mt-1">
            Your talent pool — search and build your leads list
          </p>
        </div>
        <div className="flex items-center gap-3">
          <GenerateLeadsDialog />
          <CsvImportDialog />
          <LeadPoolImportDialog />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                Actions
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Mail className="mr-2 h-4 w-4" />
                Bulk Email
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Users className="mr-2 h-4 w-4" />
                Add to Campaign
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Enrichment Status */}
      <EnrichmentStatus />

      {/* Tabs */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList variant="line">
          <TabsTrigger value="all">
            All Candidates
            <Badge variant="secondary" className="ml-2">{totalCandidates}</Badge>
          </TabsTrigger>
          <TabsTrigger value="my-leads">My Candidates</TabsTrigger>
          <TabsTrigger value="high-scoring">
            High Scoring
            <Badge variant="secondary" className="ml-2">{highScoringCount}</Badge>
          </TabsTrigger>
          <TabsTrigger value="recent">
            Recently Added
            <Badge variant="secondary" className="ml-2">{recentCount}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or company..."
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <SlidersHorizontal className="h-4 w-4 mr-2" />
                Sort
              </Button>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
              <div className="border-l pl-2 flex items-center gap-1">
                <Button variant="ghost" size="icon-sm" className="h-8 w-8">
                  <List className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon-sm" className="h-8 w-8 opacity-50">
                  <Grid3x3 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Table */}
          {candidatesList.length === 0 ? (
            <div className="border rounded-lg p-16 text-center">
              <Users className="h-16 w-16 text-muted-foreground/50 mb-4 mx-auto" />
              <h3 className="text-lg font-semibold mb-2">No candidates yet</h3>
              <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                Start adding candidates to see them here.
              </p>
              <GenerateLeadsDialog />
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="w-12">
                      <Linkedin className="h-4 w-4 text-muted-foreground" />
                    </TableHead>
                    <TableHead className="w-12"></TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {candidatesList.map((candidate) => {
                    const fullName = `${candidate.firstName} ${candidate.lastName}`.trim()
                    const initials = candidate.firstName && candidate.lastName
                      ? (candidate.firstName[0] + candidate.lastName[0]).toUpperCase()
                      : fullName.slice(0, 2).toUpperCase() || '??'

                    const detailUrl = candidate.jobId
                      ? `/jobs/${candidate.jobId}/candidates/${candidate.id}`
                      : `/candidates/${candidate.id}`

                    return (
                      <TableRow key={candidate.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell>
                          <Checkbox />
                        </TableCell>
                        <TableCell>
                          <Link href={detailUrl} className="flex items-center gap-3 group">
                            <Avatar size="sm">
                              {candidate.profileImageUrl && (
                                <AvatarImage src={candidate.profileImageUrl} alt={fullName} />
                              )}
                              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <span className="font-medium group-hover:underline block truncate">
                                {fullName || 'Unnamed'}
                              </span>
                              {candidate.location && (
                                <span className="text-xs text-muted-foreground block truncate">
                                  {candidate.location}
                                </span>
                              )}
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground truncate block max-w-[200px]">
                            {candidate.currentTitle || '—'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground truncate block max-w-[160px]">
                            {candidate.currentCompany || '—'}
                          </span>
                        </TableCell>
                        <TableCell>
                          {candidate.email ? (
                            <a
                              href={`mailto:${candidate.email}`}
                              className="text-sm text-primary hover:underline flex items-center gap-1 truncate max-w-[200px]"
                            >
                              <Mail className="h-3 w-3 shrink-0" />
                              <span className="truncate">{candidate.email}</span>
                            </a>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {candidate.phone ? (
                            <a
                              href={`tel:${candidate.phone}`}
                              className="text-sm text-primary hover:underline flex items-center gap-1"
                            >
                              <Phone className="h-3 w-3 shrink-0" />
                              <span>{candidate.phone}</span>
                            </a>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {candidate.linkedinUrl ? (
                            <a
                              href={candidate.linkedinUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#0A66C2] hover:opacity-80"
                            >
                              <Linkedin className="h-4 w-4" />
                            </a>
                          ) : (
                            <span className="text-muted-foreground/30">
                              <Linkedin className="h-4 w-4" />
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Link href={detailUrl}>
                            <Button variant="ghost" size="icon-sm" className="h-8 w-8">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                        </TableCell>
                        <TableCell>
                          <DeleteCandidateButton
                            candidateId={candidate.id}
                            candidateName={fullName || 'this candidate'}
                          />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {candidatesList.length > 0 && (
            <div className="flex items-center justify-between px-2">
              <div className="text-sm text-muted-foreground">
                Showing <span className="font-medium">1-{Math.min(candidatesList.length, 10)}</span> of{' '}
                <span className="font-medium">{candidatesList.length}</span> results
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled>
                  Next
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="my-leads">
          <div className="border rounded-lg p-16 text-center">
            <Users className="h-16 w-16 text-muted-foreground/50 mb-4 mx-auto" />
            <h3 className="text-lg font-semibold mb-2">My Candidates</h3>
            <p className="text-muted-foreground">
              This feature is coming soon.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="high-scoring">
          <div className="border rounded-lg p-16 text-center">
            <Users className="h-16 w-16 text-muted-foreground/50 mb-4 mx-auto" />
            <h3 className="text-lg font-semibold mb-2">High Scoring Leads</h3>
            <p className="text-muted-foreground">
              Leads with match scores above 75 will appear here.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="recent">
          <div className="border rounded-lg p-16 text-center">
            <Users className="h-16 w-16 text-muted-foreground/50 mb-4 mx-auto" />
            <h3 className="text-lg font-semibold mb-2">Recently Added</h3>
            <p className="text-muted-foreground">
              Leads added in the last 7 days will appear here.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
