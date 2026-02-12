'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Timer } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface OfferItem {
  interviewId: string
  candidateId: string
  companyId: string
  companyName: string
  jobTitle: string | null
  stage: string
  interviewStatus: string
  offerExpiresAt: string | null
  scheduledAt: string
}

export function CandidateOffersBoard() {
  const [offers, setOffers] = useState<OfferItem[]>([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)

  const activeOffers = useMemo(
    () => offers.filter((offer) => offer.stage === 'offer'),
    [offers]
  )

  useEffect(() => {
    void loadOffers()
  }, [])

  async function loadOffers() {
    setLoading(true)
    try {
      const res = await fetch('/api/candidate/offers')
      const payload = await res.json()
      if (!res.ok) {
        throw new Error(payload.error || 'Failed to load offers')
      }
      setOffers(payload.offers ?? [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load offers')
    } finally {
      setLoading(false)
    }
  }

  async function runAction(interviewId: string, action: 'accept' | 'decline') {
    setActionId(interviewId)
    try {
      const res = await fetch('/api/candidate/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interviewId, action }),
      })
      const payload = await res.json()
      if (!res.ok) {
        throw new Error(payload.error || 'Failed to process offer')
      }
      toast.success(action === 'accept' ? 'Offer accepted' : 'Offer declined')
      await loadOffers()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to process offer')
    } finally {
      setActionId(null)
    }
  }

  return (
    <div className="space-y-4">
      <Card className="border-orange-200">
        <CardHeader>
          <CardTitle className="text-orange-900">Offer Queue</CardTitle>
          <CardDescription>
            {activeOffers.length} active offer{activeOffers.length === 1 ? '' : 's'} requiring action.
          </CardDescription>
        </CardHeader>
      </Card>

      {loading && (
        <div className="text-sm text-gray-600">Loading offers...</div>
      )}

      {!loading && offers.length === 0 && (
        <Card className="border-orange-200">
          <CardContent className="p-6 text-sm text-gray-600">No offers available.</CardContent>
        </Card>
      )}

      {offers.map((offer) => (
        <Card key={offer.interviewId} className="border-orange-200">
          <CardHeader>
            <CardTitle className="text-lg">{offer.companyName}{offer.jobTitle ? ` • ${offer.jobTitle}` : ''}</CardTitle>
            <CardDescription>Interview started on {new Date(offer.scheduledAt).toLocaleString()}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3 items-center">
              <Badge variant={offer.stage === 'offer' ? 'default' : 'secondary'} className={offer.stage === 'offer' ? 'bg-orange-600 hover:bg-orange-600' : ''}>
                {offer.stage}
              </Badge>
              {offer.offerExpiresAt && (
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                  <Timer className="h-3.5 w-3.5" />
                  Expires {new Date(offer.offerExpiresAt).toLocaleString()}
                </span>
              )}
            </div>

            {offer.stage === 'offer' && (
              <div className="mt-4 flex items-center gap-2">
                <Button
                  onClick={() => void runAction(offer.interviewId, 'accept')}
                  disabled={actionId === offer.interviewId}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {actionId === offer.interviewId ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Accept Offer
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void runAction(offer.interviewId, 'decline')}
                  disabled={actionId === offer.interviewId}
                >
                  Decline
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
