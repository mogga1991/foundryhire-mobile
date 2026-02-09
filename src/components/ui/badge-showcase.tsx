'use client'

import { StatusBadge } from './status-badge'
import { MatchScoreBadge } from './match-score-badge'
import { SourceBadge } from './source-badge'
import { Card, CardContent, CardHeader, CardTitle } from './card'
import { Separator } from './separator'

/**
 * Badge Showcase Component
 *
 * This component demonstrates all available badge components and their variants.
 * Use this as a reference for how badges look and behave in different states.
 *
 * To view this component, create a page route and import it:
 *
 * // app/showcase/badges/page.tsx
 * import { BadgeShowcase } from '@/components/ui/badge-showcase'
 *
 * export default function BadgeShowcasePage() {
 *   return <BadgeShowcase />
 * }
 */
export function BadgeShowcase() {
  return (
    <div className="container max-w-6xl py-10 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Badge Components Showcase</h1>
        <p className="text-muted-foreground">
          Preview all available badge components and their variants
        </p>
      </div>

      <Separator />

      {/* Status Badges */}
      <Card>
        <CardHeader>
          <CardTitle>Status Badges</CardTitle>
          <p className="text-sm text-muted-foreground">
            Display candidate status with appropriate color coding
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-3">Lead Status</h3>
            <div className="flex flex-wrap gap-2">
              <StatusBadge status="hot" />
              <StatusBadge status="warm" />
              <StatusBadge status="cold" />
              <StatusBadge status="new" />
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="text-sm font-medium mb-3">Pipeline Status</h3>
            <div className="flex flex-wrap gap-2">
              <StatusBadge status="contacted" />
              <StatusBadge status="applied" />
              <StatusBadge status="screening" />
              <StatusBadge status="interview" />
              <StatusBadge status="offer" />
              <StatusBadge status="hired" />
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="text-sm font-medium mb-3">Final Status</h3>
            <div className="flex flex-wrap gap-2">
              <StatusBadge status="rejected" />
              <StatusBadge status="withdrawn" />
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="text-sm font-medium mb-3">Custom Labels</h3>
            <div className="flex flex-wrap gap-2">
              <StatusBadge status="hot">Top Priority</StatusBadge>
              <StatusBadge status="warm">Follow Up</StatusBadge>
              <StatusBadge status="cold">Low Priority</StatusBadge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Match Score Badges */}
      <Card>
        <CardHeader>
          <CardTitle>Match Score Badges</CardTitle>
          <p className="text-sm text-muted-foreground">
            Display match scores with automatic color coding (75-100: Green, 50-74: Yellow, 0-49: Gray)
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-3">Hot Matches (75-100)</h3>
            <div className="flex flex-wrap gap-2">
              <MatchScoreBadge score={100} />
              <MatchScoreBadge score={95} />
              <MatchScoreBadge score={85} />
              <MatchScoreBadge score={75} />
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="text-sm font-medium mb-3">Warm Matches (50-74)</h3>
            <div className="flex flex-wrap gap-2">
              <MatchScoreBadge score={74} />
              <MatchScoreBadge score={65} />
              <MatchScoreBadge score={55} />
              <MatchScoreBadge score={50} />
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="text-sm font-medium mb-3">Cold Matches (0-49)</h3>
            <div className="flex flex-wrap gap-2">
              <MatchScoreBadge score={49} />
              <MatchScoreBadge score={35} />
              <MatchScoreBadge score={20} />
              <MatchScoreBadge score={0} />
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="text-sm font-medium mb-3">With Labels</h3>
            <div className="flex flex-wrap gap-2">
              <MatchScoreBadge score={95} showLabel />
              <MatchScoreBadge score={65} showLabel />
              <MatchScoreBadge score={35} showLabel />
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="text-sm font-medium mb-3">Custom Content</h3>
            <div className="flex flex-wrap gap-2">
              <MatchScoreBadge score={95}>Perfect Match</MatchScoreBadge>
              <MatchScoreBadge score={65}>Good Fit</MatchScoreBadge>
              <MatchScoreBadge score={35}>Needs Review</MatchScoreBadge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Source Badges */}
      <Card>
        <CardHeader>
          <CardTitle>Source Badges</CardTitle>
          <p className="text-sm text-muted-foreground">
            Display data source with icon and label
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-3">Social Platforms</h3>
            <div className="flex flex-wrap gap-2">
              <SourceBadge source="linkedin" />
              <SourceBadge source="twitter" />
              <SourceBadge source="instagram" />
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="text-sm font-medium mb-3">Data Providers</h3>
            <div className="flex flex-wrap gap-2">
              <SourceBadge source="apify" />
              <SourceBadge source="apollo" />
              <SourceBadge source="lusha" />
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="text-sm font-medium mb-3">Other Sources</h3>
            <div className="flex flex-wrap gap-2">
              <SourceBadge source="manual" />
              <SourceBadge source="upload" />
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="text-sm font-medium mb-3">Icon Only</h3>
            <div className="flex flex-wrap gap-2">
              <SourceBadge source="linkedin" iconOnly />
              <SourceBadge source="twitter" iconOnly />
              <SourceBadge source="instagram" iconOnly />
              <SourceBadge source="apify" iconOnly />
              <SourceBadge source="apollo" iconOnly />
              <SourceBadge source="lusha" iconOnly />
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="text-sm font-medium mb-3">Text Only</h3>
            <div className="flex flex-wrap gap-2">
              <SourceBadge source="linkedin" showIcon={false} />
              <SourceBadge source="twitter" showIcon={false} />
              <SourceBadge source="instagram" showIcon={false} />
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="text-sm font-medium mb-3">Custom Labels</h3>
            <div className="flex flex-wrap gap-2">
              <SourceBadge source="linkedin">LinkedIn Premium</SourceBadge>
              <SourceBadge source="apify">Web Scraper</SourceBadge>
              <SourceBadge source="manual">Added by Recruiter</SourceBadge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Combined Usage Example */}
      <Card>
        <CardHeader>
          <CardTitle>Combined Usage Example</CardTitle>
          <p className="text-sm text-muted-foreground">
            How badges look when used together in a candidate card
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-2">
                <h4 className="font-semibold">John Doe</h4>
                <p className="text-sm text-muted-foreground">john.doe@example.com</p>
                <div className="flex flex-wrap gap-2">
                  <MatchScoreBadge score={92} />
                  <StatusBadge status="interview" />
                  <SourceBadge source="linkedin" />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-2">
                <h4 className="font-semibold">Jane Smith</h4>
                <p className="text-sm text-muted-foreground">jane.smith@example.com</p>
                <div className="flex flex-wrap gap-2">
                  <MatchScoreBadge score={68} />
                  <StatusBadge status="contacted" />
                  <SourceBadge source="apollo" />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-2">
                <h4 className="font-semibold">Bob Johnson</h4>
                <p className="text-sm text-muted-foreground">bob.johnson@example.com</p>
                <div className="flex flex-wrap gap-2">
                  <MatchScoreBadge score={45} />
                  <StatusBadge status="new" />
                  <SourceBadge source="manual" />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
