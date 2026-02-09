# Badge Components Usage Guide

This guide explains how to use the status, match score, and source badge components.

## Status Badge

Display candidate status with appropriate color coding.

### Import

```tsx
import { StatusBadge } from '@/components/ui/status-badge'
// or
import { StatusBadge } from '@/components/ui/badges'
```

### Usage

```tsx
// Automatic variant from status prop
<StatusBadge status="hot" />
<StatusBadge status="warm" />
<StatusBadge status="cold" />
<StatusBadge status="new" />
<StatusBadge status="contacted" />
<StatusBadge status="interview" />

// Explicit variant
<StatusBadge variant="hot" />

// Custom label
<StatusBadge status="hot">Custom Label</StatusBadge>
```

### Available Variants

- `hot` - Red/orange background (Hot Lead)
- `warm` - Yellow/amber background (Warm Lead)
- `cold` - Gray background (Cold Lead)
- `new` - Blue background (New)
- `contacted` - Purple background (Contacted)
- `interview` - Green background (Interview)
- `applied` - Sky blue background (Applied)
- `screening` - Indigo background (Screening)
- `offer` - Emerald background (Offer)
- `hired` - Teal background (Hired)
- `rejected` - Rose background (Rejected)
- `withdrawn` - Slate background (Withdrawn)

---

## Match Score Badge

Display match scores with automatic color coding based on score value.

### Import

```tsx
import { MatchScoreBadge } from '@/components/ui/match-score-badge'
// or
import { MatchScoreBadge } from '@/components/ui/badges'
```

### Usage

```tsx
// Basic usage - shows percentage
<MatchScoreBadge score={85} />

// With label
<MatchScoreBadge score={85} showLabel />

// Custom content
<MatchScoreBadge score={85}>Top Match</MatchScoreBadge>
```

### Score Color Coding

- **75-100** - Green (Hot)
- **50-74** - Yellow (Warm)
- **0-49** - Gray (Cold)

### Helper Functions

```tsx
import { getScoreVariant, getScoreLabel } from '@/components/ui/match-score-badge'

const variant = getScoreVariant(85) // 'hot'
const label = getScoreLabel(85) // 'Hot'
```

---

## Source Badge

Display data source with icon and label.

### Import

```tsx
import { SourceBadge } from '@/components/ui/source-badge'
// or
import { SourceBadge } from '@/components/ui/badges'
```

### Usage

```tsx
// Basic usage - shows icon and text
<SourceBadge source="linkedin" />
<SourceBadge source="twitter" />
<SourceBadge source="instagram" />
<SourceBadge source="apify" />
<SourceBadge source="apollo" />
<SourceBadge source="lusha" />

// Icon only
<SourceBadge source="linkedin" iconOnly />

// Text only
<SourceBadge source="linkedin" showIcon={false} />

// Custom text
<SourceBadge source="linkedin">Custom Source</SourceBadge>
```

### Available Sources

- `linkedin` - Blue with LinkedIn icon
- `twitter` - Slate with Twitter/X icon
- `instagram` - Pink with Instagram icon
- `apify` - Violet with Database icon
- `apollo` - Indigo with Search icon
- `lusha` - Emerald with Database icon
- `manual` - Gray with Database icon
- `upload` - Amber with Database icon

---

## Candidate Table

Full-featured table component for displaying candidates.

### Import

```tsx
import { CandidateTable } from '@/components/candidates/candidate-table'
```

### Basic Usage

```tsx
const candidates = [
  {
    id: '1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    currentTitle: 'Software Engineer',
    currentCompany: 'Tech Corp',
    aiScore: 85,
    status: 'new',
    source: 'linkedin',
    createdAt: new Date(),
    // ... other candidate fields
  },
]

<CandidateTable
  candidates={candidates}
  jobId="job-123"
/>
```

### Features

#### 1. Sortable Columns

Click on column headers to sort:
- Name
- Email
- Match Score
- Status
- Source
- Created At

```tsx
<CandidateTable
  candidates={candidates}
  initialSort={{ field: 'score', direction: 'desc' }}
/>
```

#### 2. Row Selection

```tsx
<CandidateTable
  candidates={candidates}
  onSelectionChange={(selectedIds) => {
    console.log('Selected:', selectedIds)
  }}
/>
```

#### 3. Custom Row Click Handler

```tsx
<CandidateTable
  candidates={candidates}
  onRowClick={(candidate) => {
    console.log('Clicked:', candidate)
    // Custom navigation or modal
  }}
/>
```

#### 4. Pagination

```tsx
<CandidateTable
  candidates={candidates}
  page={1}
  totalPages={10}
  onPageChange={(page) => {
    console.log('Navigate to page:', page)
  }}
/>
```

#### 5. Loading State

```tsx
<CandidateTable
  candidates={[]}
  loading={true}
/>
```

### Full Example

```tsx
'use client'

import { useState } from 'react'
import { CandidateTable } from '@/components/candidates/candidate-table'

export function CandidatesPage() {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [page, setPage] = useState(1)

  return (
    <div>
      <h1>Candidates</h1>

      {selectedIds.length > 0 && (
        <div className="mb-4">
          <p>{selectedIds.length} candidates selected</p>
          <button onClick={() => console.log('Bulk action', selectedIds)}>
            Send Email to Selected
          </button>
        </div>
      )}

      <CandidateTable
        candidates={candidates}
        jobId="job-123"
        page={page}
        totalPages={5}
        onPageChange={setPage}
        onSelectionChange={setSelectedIds}
        initialSort={{ field: 'score', direction: 'desc' }}
      />
    </div>
  )
}
```

---

## Styling

All components support custom className for additional styling:

```tsx
<StatusBadge status="hot" className="text-lg" />
<MatchScoreBadge score={85} className="font-bold" />
<SourceBadge source="linkedin" className="rounded-md" />
<CandidateTable candidates={candidates} className="shadow-lg" />
```

## Dark Mode

All components are dark mode compatible using Tailwind's dark mode classes.
