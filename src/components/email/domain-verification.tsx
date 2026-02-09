'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { CheckCircle, XCircle, Clock, Loader2, Copy, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { DomainIdentity } from '@/hooks/use-email-accounts'

interface DnsRecord {
  type: string
  name: string
  value: string
  priority?: number
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'verified':
      return <CheckCircle className="h-4 w-4 text-green-500" />
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-500" />
    default:
      return <Clock className="h-4 w-4 text-yellow-500" />
  }
}

function DnsRecordRow({ record }: { record: DnsRecord }) {
  function copyValue() {
    navigator.clipboard.writeText(record.value)
    toast.success('Copied to clipboard')
  }

  return (
    <div className="flex items-center gap-4 rounded-lg border p-3 text-sm">
      <Badge variant="outline" className="shrink-0 font-mono">
        {record.type}
      </Badge>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-xs text-muted-foreground">{record.name}</p>
        <p className="truncate font-mono text-xs">{record.value}</p>
      </div>
      <Button variant="ghost" size="sm" onClick={copyValue}>
        <Copy className="h-3 w-3" />
      </Button>
    </div>
  )
}

function getDomainStatus(domain: DomainIdentity): string {
  if (domain.verifiedAt) return 'verified'
  if (domain.dkimStatus === 'verified' && domain.spfStatus === 'verified') return 'verified'
  if (domain.dkimStatus === 'failed' || domain.spfStatus === 'failed') return 'failed'
  return 'pending'
}

export function DomainVerification({
  domains,
  onRefresh,
}: {
  domains: DomainIdentity[]
  onRefresh: () => void
}) {
  const [newDomain, setNewDomain] = useState('')
  const [adding, setAdding] = useState(false)
  const [verifyingId, setVerifyingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleAddDomain() {
    if (!newDomain.trim()) return
    setAdding(true)
    try {
      const res = await fetch('/api/email/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: newDomain.trim() }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Failed to add domain')
      }
      toast.success('Domain added. Configure the DNS records below.')
      setNewDomain('')
      onRefresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add domain')
    } finally {
      setAdding(false)
    }
  }

  async function handleVerify(domainId: string) {
    setVerifyingId(domainId)
    try {
      const res = await fetch(`/api/email/domains/${domainId}/verify`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Verification failed')
      const json = await res.json()
      if (json.verified) {
        toast.success('Domain verified!')
      } else {
        toast.info('DNS records not yet propagated. Try again in a few minutes.')
      }
      onRefresh()
    } catch {
      toast.error('Failed to verify domain')
    } finally {
      setVerifyingId(null)
    }
  }

  async function handleDelete(domainId: string) {
    if (!confirm('Remove this domain?')) return
    setDeletingId(domainId)
    try {
      const res = await fetch(`/api/email/domains/${domainId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete')
      toast.success('Domain removed')
      onRefresh()
    } catch {
      toast.error('Failed to remove domain')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Domain Verification</CardTitle>
        <CardDescription>
          Verify your domain to send emails from your own address. Add the DNS
          records below to your domain provider.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="example.com"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddDomain()}
          />
          <Button onClick={handleAddDomain} disabled={adding || !newDomain.trim()}>
            {adding ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Add Domain
          </Button>
        </div>

        {domains.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No domains configured yet. Add a domain above to get started.
          </p>
        )}

        {domains.map((domain) => {
          const status = getDomainStatus(domain)
          return (
            <div key={domain.id} className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StatusIcon status={status} />
                  <span className="font-medium">{domain.domain}</span>
                  <Badge variant={status === 'verified' ? 'default' : 'secondary'}>
                    {status}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  {status !== 'verified' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleVerify(domain.id)}
                      disabled={verifyingId === domain.id}
                    >
                      {verifyingId === domain.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Verify
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(domain.id)}
                    disabled={deletingId === domain.id}
                    className="text-destructive hover:text-destructive"
                  >
                    {deletingId === domain.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {domain.dkimRecords && (domain.dkimRecords as unknown[]).length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    DNS Records to configure:
                  </p>
                  {(domain.dkimRecords as unknown as DnsRecord[]).map((record, idx) => (
                    <DnsRecordRow key={idx} record={record} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
