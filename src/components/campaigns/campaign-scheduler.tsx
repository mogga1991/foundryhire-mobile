'use client'

import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
  Send,
  Clock,
  CalendarDays,
  Sparkles,
  Loader2,
  Globe,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

type SendOption = 'now' | 'schedule' | 'optimal'

interface CampaignSchedulerProps {
  campaignId: string
  campaignName: string
  recipientCount: number
  onSend?: () => void
  disabled?: boolean
}

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'Europe/London', label: 'Greenwich Mean Time (GMT)' },
  { value: 'Europe/Paris', label: 'Central European Time (CET)' },
  { value: 'Europe/Berlin', label: 'Central European Time (CET)' },
  { value: 'Asia/Tokyo', label: 'Japan Standard Time (JST)' },
  { value: 'Asia/Shanghai', label: 'China Standard Time (CST)' },
  { value: 'Asia/Kolkata', label: 'India Standard Time (IST)' },
  { value: 'Australia/Sydney', label: 'Australian Eastern Time (AET)' },
  { value: 'UTC', label: 'Coordinated Universal Time (UTC)' },
]

function getDefaultTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return 'America/New_York'
  }
}

function getOptimalSendTime(): Date {
  const now = new Date()
  const optimal = new Date(now)
  // Set to next 9:30am
  optimal.setHours(9, 30, 0, 0)
  if (optimal <= now) {
    optimal.setDate(optimal.getDate() + 1)
  }
  // Skip weekends
  const day = optimal.getDay()
  if (day === 0) optimal.setDate(optimal.getDate() + 1) // Sunday -> Monday
  if (day === 6) optimal.setDate(optimal.getDate() + 2) // Saturday -> Monday
  return optimal
}

export function CampaignScheduler({
  campaignId,
  campaignName,
  recipientCount,
  onSend,
  disabled = false,
}: CampaignSchedulerProps) {
  const [open, setOpen] = useState(false)
  const [sendOption, setSendOption] = useState<SendOption>('now')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('09:00')
  const [timezone, setTimezone] = useState(getDefaultTimezone)
  const [sending, setSending] = useState(false)

  const optimalTime = useMemo(() => getOptimalSendTime(), [])

  const estimatedDelivery = useMemo(() => {
    if (sendOption === 'now') {
      return new Date()
    }
    if (sendOption === 'optimal') {
      return optimalTime
    }
    if (scheduledDate && scheduledTime) {
      return new Date(`${scheduledDate}T${scheduledTime}`)
    }
    return null
  }, [sendOption, scheduledDate, scheduledTime, optimalTime])

  const isScheduleValid = sendOption !== 'schedule' || (scheduledDate && scheduledTime)

  async function handleSend() {
    if (!isScheduleValid) {
      toast.error('Please select a date and time for scheduling.')
      return
    }

    setSending(true)

    try {
      if (sendOption === 'now') {
        // Send immediately via the existing send endpoint
        const res = await fetch(`/api/campaigns/${campaignId}/send`, {
          method: 'POST',
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to send campaign')
        }
        toast.success('Campaign is now sending!')
      } else {
        // Schedule the campaign
        const sendAt =
          sendOption === 'optimal'
            ? optimalTime.toISOString()
            : new Date(`${scheduledDate}T${scheduledTime}`).toISOString()

        const res = await fetch(`/api/campaigns?id=${campaignId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'scheduled',
            scheduledAt: sendAt,
            timezone,
          }),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to schedule campaign')
        }
        toast.success(
          `Campaign scheduled for ${format(new Date(sendAt), 'PPp')}`
        )
      }

      setOpen(false)
      onSend?.()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong'
      toast.error(message)
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={disabled}>
          <Send className="h-4 w-4" />
          Send Campaign
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Send Campaign</DialogTitle>
          <DialogDescription>
            Choose when to send &ldquo;{campaignName}&rdquo; to{' '}
            {recipientCount} recipient{recipientCount !== 1 ? 's' : ''}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Recipient confirmation */}
          <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3 text-sm">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span>
              <strong>{recipientCount}</strong> recipient
              {recipientCount !== 1 ? 's' : ''} will receive this campaign
            </span>
          </div>

          {/* Send options */}
          <div className="grid gap-3">
            <SendOptionCard
              selected={sendOption === 'now'}
              onClick={() => setSendOption('now')}
              icon={<Send className="h-5 w-5" />}
              title="Send Now"
              description="Begin delivering emails immediately"
            />
            <SendOptionCard
              selected={sendOption === 'schedule'}
              onClick={() => setSendOption('schedule')}
              icon={<CalendarDays className="h-5 w-5" />}
              title="Schedule"
              description="Pick a specific date and time"
            />
            <SendOptionCard
              selected={sendOption === 'optimal'}
              onClick={() => setSendOption('optimal')}
              icon={<Sparkles className="h-5 w-5" />}
              title="Send at Optimal Time"
              description="Delivers between 9-11 AM in recipient's timezone"
            />
          </div>

          {/* Schedule options */}
          {sendOption === 'schedule' && (
            <div className="space-y-3 rounded-lg border p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="schedule-date">Date</Label>
                  <Input
                    id="schedule-date"
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    min={format(new Date(), 'yyyy-MM-dd')}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="schedule-time">Time</Label>
                  <Input
                    id="schedule-time"
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="timezone">
                  <Globe className="mr-1 inline h-3.5 w-3.5" />
                  Timezone
                </Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger id="timezone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Estimated delivery */}
          {estimatedDelivery && (
            <>
              <Separator />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>
                  Estimated delivery:{' '}
                  <strong className="text-foreground">
                    {sendOption === 'now'
                      ? 'Starting immediately'
                      : format(estimatedDelivery, 'PPP \'at\' p')}
                  </strong>
                </span>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || !isScheduleValid}
          >
            {sending && <Loader2 className="h-4 w-4 animate-spin" />}
            {sendOption === 'now'
              ? 'Send Now'
              : sendOption === 'optimal'
                ? 'Schedule Optimal Send'
                : 'Schedule Send'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Sub-component for send option cards
function SendOptionCard({
  selected,
  onClick,
  icon,
  title,
  description,
}: {
  selected: boolean
  onClick: () => void
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent/50',
        selected && 'border-primary bg-primary/5 ring-1 ring-primary'
      )}
      aria-pressed={selected}
    >
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
          selected
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground'
        )}
      >
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </button>
  )
}
