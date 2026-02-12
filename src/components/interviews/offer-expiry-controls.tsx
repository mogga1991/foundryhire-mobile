'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Timer } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface OfferExpiryControlsProps {
  interviewId: string
  candidateName: string
  currentExpiresAt?: string | null
}

function toDateTimeLocalValue(value: Date): string {
  const pad = (num: number) => String(num).padStart(2, '0')
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`
}

export function OfferExpiryControls({
  interviewId,
  candidateName,
  currentExpiresAt,
}: OfferExpiryControlsProps) {
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)

  const defaultValue = useMemo(() => {
    if (currentExpiresAt) {
      return toDateTimeLocalValue(new Date(currentExpiresAt))
    }
    const fallback = new Date(Date.now() + 72 * 60 * 60 * 1000)
    return toDateTimeLocalValue(fallback)
  }, [currentExpiresAt])

  const [expiresAtLocal, setExpiresAtLocal] = useState(defaultValue)

  async function handleSetOffer() {
    if (!expiresAtLocal) {
      toast.error('Please select an expiry date and time')
      return
    }

    const expiresAt = new Date(expiresAtLocal)
    if (Number.isNaN(expiresAt.getTime())) {
      toast.error('Invalid expiry date')
      return
    }
    if (expiresAt <= new Date()) {
      toast.error('Offer expiry must be in the future')
      return
    }

    setIsSaving(true)
    try {
      const res = await fetch(`/api/interviews/${interviewId}/offer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresAt: expiresAt.toISOString() }),
      })

      const payload = await res.json()
      if (!res.ok) {
        throw new Error(payload.error || 'Failed to set offer expiry')
      }

      toast.success(`Offer configured for ${candidateName}`)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to set offer expiry')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-orange-200 bg-orange-50 p-3">
      <div className="flex items-center gap-2 text-sm font-medium text-orange-900">
        <Timer className="h-4 w-4" />
        Offer Expiry
      </div>
      <Input
        type="datetime-local"
        value={expiresAtLocal}
        onChange={(event) => setExpiresAtLocal(event.target.value)}
      />
      <Button
        onClick={handleSetOffer}
        disabled={isSaving}
        size="sm"
        className="w-full bg-orange-600 hover:bg-orange-700"
      >
        {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
        Set Offer + Expiry
      </Button>
    </div>
  )
}
