'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Mail, Star, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface EmailAccount {
  id: string
  type: 'esp' | 'gmail_oauth' | 'microsoft_oauth' | 'smtp'
  fromAddress: string
  fromName: string | null
  isDefault: boolean
  status: string
}

const typeLabels: Record<string, string> = {
  esp: 'Domain (Resend)',
  gmail_oauth: 'Gmail',
  microsoft_oauth: 'Microsoft',
  smtp: 'SMTP',
}

const typeBadgeVariants: Record<string, string> = {
  esp: 'bg-blue-100 text-blue-800',
  gmail_oauth: 'bg-red-100 text-red-800',
  microsoft_oauth: 'bg-purple-100 text-purple-800',
  smtp: 'bg-gray-100 text-gray-800',
}

export function EmailAccountCard({
  account,
  onRefresh,
}: {
  account: EmailAccount
  onRefresh: () => void
}) {
  const [deleting, setDeleting] = useState(false)
  const [settingDefault, setSettingDefault] = useState(false)

  async function handleDelete() {
    if (!confirm('Are you sure you want to remove this email account?')) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/email/accounts/${account.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      toast.success('Email account removed')
      onRefresh()
    } catch {
      toast.error('Failed to remove email account')
    } finally {
      setDeleting(false)
    }
  }

  async function handleSetDefault() {
    setSettingDefault(true)
    try {
      const res = await fetch(`/api/email/accounts/${account.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      })
      if (!res.ok) throw new Error('Failed to update')
      toast.success('Default email account updated')
      onRefresh()
    } catch {
      toast.error('Failed to set default')
    } finally {
      setSettingDefault(false)
    }
  }

  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <Mail className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{account.fromAddress}</span>
              {account.isDefault && (
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              )}
            </div>
            {account.fromName && (
              <p className="text-sm text-muted-foreground">{account.fromName}</p>
            )}
          </div>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              typeBadgeVariants[account.type] || 'bg-gray-100 text-gray-800'
            }`}
          >
            {typeLabels[account.type] || account.type}
          </span>
          <Badge variant={account.status === 'active' ? 'default' : 'secondary'}>
            {account.status}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {!account.isDefault && account.status === 'active' && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSetDefault}
              disabled={settingDefault}
            >
              {settingDefault ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Set Default'
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
            className="text-destructive hover:text-destructive"
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
