'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import {
  Mail,
  Send,
  Eye,
  MousePointer,
  MessageSquare,
  AlertCircle,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  Inbox,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { CampaignControls, CampaignStatusBadge, type CampaignStatus } from './campaign-controls'
import { CampaignScheduler } from './campaign-scheduler'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SerializedCampaign {
  id: string
  name: string
  subject: string
  body: string
  status: string
  campaignType: string
  scheduledAt: string | null
  sentAt: string | null
  createdAt: string
  updatedAt: string
  totalRecipients: number
  totalSent: number
  totalOpened: number
  totalClicked: number
  totalReplied: number
  totalBounced: number
  jobId: string | null
}

interface SerializedSend {
  sendId: string
  status: string
  sentAt: string | null
  openedAt: string | null
  clickedAt: string | null
  repliedAt: string | null
  bouncedAt: string | null
  errorMessage: string | null
  candidateId: string
  candidateFirstName: string
  candidateLastName: string
  candidateEmail: string | null
  candidateTitle: string | null
}

interface LiveStats {
  totalRecipients: number
  totalSent: number
  totalOpened: number
  totalClicked: number
  totalReplied: number
  totalBounced: number
  totalPending: number
}

interface CampaignDetailClientProps {
  campaign: SerializedCampaign
  sends: SerializedSend[]
  liveStats: LiveStats
}

// ---------------------------------------------------------------------------
// Send status config
// ---------------------------------------------------------------------------

const sendStatusConfig: Record<
  string,
  { label: string; className: string; icon: typeof CheckCircle2 }
> = {
  pending: { label: 'Pending', className: 'bg-gray-100 text-gray-800', icon: Clock },
  queued: { label: 'Queued', className: 'bg-blue-100 text-blue-800', icon: Clock },
  sent: { label: 'Sent', className: 'bg-green-100 text-green-800', icon: Send },
  delivered: { label: 'Delivered', className: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  opened: { label: 'Opened', className: 'bg-emerald-100 text-emerald-800', icon: Eye },
  clicked: { label: 'Clicked', className: 'bg-indigo-100 text-indigo-800', icon: MousePointer },
  replied: { label: 'Replied', className: 'bg-purple-100 text-purple-800', icon: MessageSquare },
  bounced: { label: 'Bounced', className: 'bg-red-100 text-red-800', icon: AlertCircle },
  cancelled: { label: 'Cancelled', className: 'bg-gray-100 text-gray-600', icon: XCircle },
  failed: { label: 'Failed', className: 'bg-red-100 text-red-800', icon: XCircle },
}

function getSendDisplayStatus(send: SerializedSend): string {
  if (send.repliedAt) return 'replied'
  if (send.clickedAt) return 'clicked'
  if (send.openedAt) return 'opened'
  if (send.bouncedAt) return 'bounced'
  if (send.sentAt) return 'sent'
  if (send.status === 'cancelled' || send.status === 'failed') return send.status
  return send.status
}

// ---------------------------------------------------------------------------
// Stat card sub-component
// ---------------------------------------------------------------------------

function StatCard({
  label,
  count,
  total,
  icon: Icon,
  color,
}: {
  label: string
  count: number
  total: number
  icon: typeof Send
  color: string
}) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold">{count}</p>
              <p className="text-sm text-muted-foreground">{percentage}%</p>
            </div>
          </div>
          <div className={cn('flex h-10 w-10 items-center justify-center rounded-full', color)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Timeline event component
// ---------------------------------------------------------------------------

interface TimelineEvent {
  label: string
  date: string | null
  icon: typeof Send
  color: string
}

function CampaignTimeline({ events }: { events: TimelineEvent[] }) {
  const filledEvents = events.filter((e) => e.date !== null)
  if (filledEvents.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No activity yet.</p>
    )
  }

  return (
    <div className="space-y-3">
      {filledEvents.map((event, i) => {
        const Icon = event.icon
        return (
          <div key={i} className="flex items-start gap-3">
            <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', event.color)}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium">{event.label}</p>
              <p className="text-xs text-muted-foreground">
                {event.date ? format(new Date(event.date), 'PPp') : ''}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CampaignDetailClient({
  campaign,
  sends,
  liveStats,
}: CampaignDetailClientProps) {
  const router = useRouter()
  const [showAllRecipients, setShowAllRecipients] = useState(false)
  const [currentStatus, setCurrentStatus] = useState<CampaignStatus>(
    campaign.status as CampaignStatus
  )

  const totalBase = liveStats.totalSent > 0 ? liveStats.totalSent : liveStats.totalRecipients
  const isDraft = currentStatus === 'draft'

  // Build timeline events
  const timelineEvents: TimelineEvent[] = [
    {
      label: 'Campaign created',
      date: campaign.createdAt,
      icon: Mail,
      color: 'bg-gray-100 text-gray-600',
    },
    ...(campaign.scheduledAt
      ? [
          {
            label: 'Scheduled for delivery',
            date: campaign.scheduledAt,
            icon: Clock,
            color: 'bg-blue-100 text-blue-600',
          } as TimelineEvent,
        ]
      : []),
    ...(campaign.sentAt
      ? [
          {
            label: 'Campaign started sending',
            date: campaign.sentAt,
            icon: Send,
            color: 'bg-green-100 text-green-600',
          } as TimelineEvent,
        ]
      : []),
    ...(currentStatus === 'completed'
      ? [
          {
            label: 'Campaign completed',
            date: campaign.updatedAt,
            icon: CheckCircle2,
            color: 'bg-purple-100 text-purple-600',
          } as TimelineEvent,
        ]
      : []),
    ...(currentStatus === 'cancelled'
      ? [
          {
            label: 'Campaign cancelled',
            date: campaign.updatedAt,
            icon: XCircle,
            color: 'bg-red-100 text-red-600',
          } as TimelineEvent,
        ]
      : []),
  ]

  const displayedSends = showAllRecipients ? sends : sends.slice(0, 10)

  // Render the merge-tag preview of the email
  const sampleBody = campaign.body
    .replace(/\{\{firstName\}\}/g, 'John')
    .replace(/\{\{lastName\}\}/g, 'Doe')
    .replace(/\{\{candidate_name\}\}/g, 'John Doe')
    .replace(/\{\{currentCompany\}\}/g, 'Acme Corp')
    .replace(/\{\{currentTitle\}\}/g, 'Software Engineer')
    .replace(/\{\{jobTitle\}\}/g, 'Senior Engineer')
    .replace(/\{\{job_title\}\}/g, 'Senior Engineer')
    .replace(/\{\{company_name\}\}/g, 'Your Company')
    .replace(/\{\{companyName\}\}/g, 'Your Company')
    .replace(/\{\{location\}\}/g, 'San Francisco, CA')
    .replace(/\{\{senderName\}\}/g, 'Recruiter')

  const sampleSubject = campaign.subject
    .replace(/\{\{firstName\}\}/g, 'John')
    .replace(/\{\{job_title\}\}/g, 'Senior Engineer')
    .replace(/\{\{company_name\}\}/g, 'Your Company')

  return (
    <div className="space-y-6">
      {/* Campaign controls + Scheduler */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <CampaignStatusBadge status={currentStatus} />
        <div className="flex items-center gap-2">
          {isDraft && (
            <CampaignScheduler
              campaignId={campaign.id}
              campaignName={campaign.name}
              recipientCount={liveStats.totalRecipients}
              onSend={() => router.refresh()}
            />
          )}
        </div>
      </div>

      {/* Controls for active/sending/paused */}
      {!isDraft && currentStatus !== 'completed' && currentStatus !== 'cancelled' && (
        <Card>
          <CardContent className="pt-6">
            <CampaignControls
              campaignId={campaign.id}
              status={currentStatus}
              totalSent={liveStats.totalSent}
              totalRecipients={liveStats.totalRecipients}
              onStatusChange={setCurrentStatus}
            />
          </CardContent>
        </Card>
      )}

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Recipients"
          count={liveStats.totalRecipients}
          total={liveStats.totalRecipients}
          icon={Users}
          color="bg-gray-100 text-gray-600 dark:bg-gray-900/30"
        />
        <StatCard
          label="Sent"
          count={liveStats.totalSent}
          total={liveStats.totalRecipients}
          icon={Send}
          color="bg-blue-100 text-blue-600 dark:bg-blue-900/30"
        />
        <StatCard
          label="Opened"
          count={liveStats.totalOpened}
          total={totalBase}
          icon={Eye}
          color="bg-green-100 text-green-600 dark:bg-green-900/30"
        />
        <StatCard
          label="Clicked"
          count={liveStats.totalClicked}
          total={totalBase}
          icon={MousePointer}
          color="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30"
        />
        <StatCard
          label="Replied"
          count={liveStats.totalReplied}
          total={totalBase}
          icon={MessageSquare}
          color="bg-purple-100 text-purple-600 dark:bg-purple-900/30"
        />
        <StatCard
          label="Bounced"
          count={liveStats.totalBounced}
          total={totalBase}
          icon={AlertCircle}
          color="bg-red-100 text-red-600 dark:bg-red-900/30"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column: Email preview + Recipients */}
        <div className="lg:col-span-2 space-y-6">
          {/* Email content preview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Preview
              </CardTitle>
              <CardDescription>
                Preview of the email with sample merge tag data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border p-4 space-y-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Subject
                  </p>
                  <p className="text-sm font-semibold">{sampleSubject}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Body
                  </p>
                  <div className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                    {sampleBody}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recipient list */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Recipients ({sends.length})
              </CardTitle>
              <CardDescription>
                Individual delivery status for each recipient
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sends.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Inbox className="h-12 w-12 text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">
                    No recipients added yet
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Recipient</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Last Activity</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {displayedSends.map((send) => {
                          const displayStatus = getSendDisplayStatus(send)
                          const config = sendStatusConfig[displayStatus] || sendStatusConfig.pending
                          const StatusIcon = config.icon
                          const lastDate =
                            send.repliedAt ??
                            send.clickedAt ??
                            send.openedAt ??
                            send.bouncedAt ??
                            send.sentAt

                          return (
                            <TableRow key={send.sendId}>
                              <TableCell>
                                <div className="min-w-0">
                                  <p className="font-medium text-sm truncate">
                                    {send.candidateFirstName} {send.candidateLastName}
                                  </p>
                                  {send.candidateTitle && (
                                    <p className="text-xs text-muted-foreground truncate">
                                      {send.candidateTitle}
                                    </p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm text-muted-foreground truncate block max-w-[200px]">
                                  {send.candidateEmail || '-'}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge className={cn('gap-1', config.className)}>
                                  <StatusIcon className="h-3 w-3" />
                                  {config.label}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <span className="text-xs text-muted-foreground">
                                  {lastDate
                                    ? format(new Date(lastDate), 'MMM d, h:mm a')
                                    : '-'}
                                </span>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {sends.length > 10 && (
                    <div className="flex justify-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAllRecipients(!showAllRecipients)}
                      >
                        {showAllRecipients ? (
                          <>
                            <ChevronUp className="h-4 w-4" />
                            Show Less
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-4 w-4" />
                            Show All {sends.length} Recipients
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column: Timeline + Campaign details */}
        <div className="space-y-6">
          {/* Campaign controls for completed/cancelled (show status) */}
          {(currentStatus === 'completed' || currentStatus === 'cancelled') && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <CampaignStatusBadge status={currentStatus} />
                  <span className="text-sm text-muted-foreground">
                    {liveStats.totalSent} / {liveStats.totalRecipients} sent
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Campaign Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CampaignTimeline events={timelineEvents} />
            </CardContent>
          </Card>

          {/* Campaign Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Campaign Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Type</p>
                <p className="font-medium capitalize">{campaign.campaignType}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <CampaignStatusBadge status={currentStatus} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Created</p>
                <p className="font-medium">
                  {format(new Date(campaign.createdAt), 'PPp')}
                </p>
              </div>
              {campaign.scheduledAt && (
                <div>
                  <p className="text-xs text-muted-foreground">Scheduled</p>
                  <p className="font-medium">
                    {format(new Date(campaign.scheduledAt), 'PPp')}
                  </p>
                </div>
              )}
              {campaign.sentAt && (
                <div>
                  <p className="text-xs text-muted-foreground">Started Sending</p>
                  <p className="font-medium">
                    {format(new Date(campaign.sentAt), 'PPp')}
                  </p>
                </div>
              )}
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground">Delivery Summary</p>
                <div className="mt-1 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sent</span>
                    <span className="font-medium">{liveStats.totalSent}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pending</span>
                    <span className="font-medium">{liveStats.totalPending}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bounced</span>
                    <span className="font-medium text-red-600">{liveStats.totalBounced}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
