'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Mail, Send, Users, TrendingUp, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { CampaignStatusBadge } from '@/components/campaigns/campaign-controls'

interface Campaign {
  id: string
  name: string
  status: string
  totalRecipients: number | null
  totalSent: number | null
  totalOpened: number | null
  totalClicked: number | null
  totalReplied: number | null
  createdAt: Date
  scheduledAt: Date | null
  jobId: string | null
  jobTitle: string | null
}

interface Stats {
  totalCampaigns: number
  totalSent: number
  totalOpened: number
  totalReplied: number
  openRate: number
  replyRate: number
}

interface CampaignsListProps {
  campaigns: Campaign[]
  stats: Stats
  firstJobId: string | null
}

export function CampaignsList({ campaigns, stats, firstJobId }: CampaignsListProps) {
  const [activeTab, setActiveTab] = useState('all')

  const filteredCampaigns = campaigns.filter((campaign) => {
    if (activeTab === 'all') return true
    return campaign.status === activeTab
  })

  const statusCounts = {
    all: campaigns.length,
    draft: campaigns.filter((c) => c.status === 'draft').length,
    active: campaigns.filter((c) => c.status === 'active').length,
    completed: campaigns.filter((c) => c.status === 'completed').length,
    paused: campaigns.filter((c) => c.status === 'paused').length,
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Mail className="size-8" />
            Campaigns
          </h1>
          <p className="text-muted-foreground mt-1">
            View and manage all your email campaigns across jobs.
          </p>
        </div>
        {firstJobId && (
          <Link href={`/jobs/${firstJobId}/campaigns/new`}>
            <Button size="lg">
              <Plus className="size-4" />
              Create Campaign
            </Button>
          </Link>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Campaigns</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCampaigns}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Emails Sent</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSent}</div>
            <p className="text-xs text-muted-foreground">Across all campaigns</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.openRate}%</div>
            <p className="text-xs text-muted-foreground">{stats.totalOpened} opened</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reply Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.replyRate}%</div>
            <p className="text-xs text-muted-foreground">{stats.totalReplied} replied</p>
          </CardContent>
        </Card>
      </div>

      {/* Status Filter Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">
            All ({statusCounts.all})
          </TabsTrigger>
          <TabsTrigger value="draft">
            Draft ({statusCounts.draft})
          </TabsTrigger>
          <TabsTrigger value="active">
            Active ({statusCounts.active})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({statusCounts.completed})
          </TabsTrigger>
          <TabsTrigger value="paused">
            Paused ({statusCounts.paused})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {/* Campaigns List */}
          {filteredCampaigns.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Mail className="h-16 w-16 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  {activeTab === 'all' ? 'No campaigns yet' : `No ${activeTab} campaigns`}
                </h3>
                <p className="text-muted-foreground mb-6 max-w-sm">
                  {activeTab === 'all'
                    ? 'Create your first email campaign to start reaching out to candidates.'
                    : `You don't have any campaigns with status "${activeTab}".`}
                </p>
                {firstJobId && activeTab === 'all' && (
                  <Link href={`/jobs/${firstJobId}/campaigns/new`}>
                    <Button>Create Your First Campaign</Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredCampaigns.map((campaign) => {
                const sent = campaign.totalSent || 0
                const recipients = campaign.totalRecipients || 0
                const progressPercent = recipients > 0 ? Math.round((sent / recipients) * 100) : 0
                const opened = campaign.totalOpened || 0
                const replied = campaign.totalReplied || 0
                const campaignOpenRate = sent > 0 ? Math.round((opened / sent) * 100) : 0
                const campaignReplyRate = sent > 0 ? Math.round((replied / sent) * 100) : 0

                return (
                  <Link
                    key={campaign.id}
                    href={campaign.jobId ? `/jobs/${campaign.jobId}/campaigns/${campaign.id}` : '#'}
                  >
                    <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                      <CardContent className="p-6">
                        <div className="space-y-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className="font-semibold text-lg truncate">
                                  {campaign.name}
                                </h3>
                                <CampaignStatusBadge
                                  status={campaign.status as any}
                                />
                              </div>
                              {campaign.jobTitle && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                                  <Badge variant="secondary">
                                    {campaign.jobTitle}
                                  </Badge>
                                  <span>•</span>
                                  <span>Created {campaign.createdAt.toLocaleDateString()}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Progress Bar */}
                          {campaign.status !== 'draft' && recipients > 0 && (
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">
                                  {sent} of {recipients} sent
                                </span>
                                <span className="font-medium">{progressPercent}%</span>
                              </div>
                              <Progress value={progressPercent} />
                            </div>
                          )}

                          {/* Stats Row */}
                          <div className="flex gap-6 text-sm">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              <span className="text-muted-foreground">
                                {recipients} recipients
                              </span>
                            </div>
                            {sent > 0 && (
                              <>
                                <div className="flex items-center gap-2">
                                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-muted-foreground">
                                    {campaignOpenRate}% opened
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Mail className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-muted-foreground">
                                    {campaignReplyRate}% replied
                                  </span>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                )
              })}
            </div>
          )}

          {filteredCampaigns.length > 0 && (
            <div className="text-center text-sm text-muted-foreground mt-6">
              Showing {filteredCampaigns.length} campaign{filteredCampaigns.length === 1 ? '' : 's'}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
