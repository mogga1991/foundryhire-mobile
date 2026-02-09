'use client'

import { use } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CampaignList } from '@/components/campaigns/campaign-list'
import { useCampaigns } from '@/hooks/use-campaigns'
import { useJob } from '@/hooks/use-jobs'
import { Plus, Loader2, ArrowLeft } from 'lucide-react'

interface CampaignsPageProps {
  params: Promise<{ id: string }>
}

export default function CampaignsPage({ params }: CampaignsPageProps) {
  const { id: jobId } = use(params)
  const { data: campaigns, loading, error } = useCampaigns(jobId)
  const { data: job } = useJob(jobId)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/jobs/${jobId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Campaigns</h1>
          {job && (
            <p className="text-sm text-muted-foreground">
              Outreach campaigns for {job.title}
            </p>
          )}
        </div>
        <Link href={`/jobs/${jobId}/campaigns/new`}>
          <Button>
            <Plus className="h-4 w-4" />
            Create Campaign
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      ) : (
        <CampaignList campaigns={campaigns} jobId={jobId} />
      )}
    </div>
  )
}
