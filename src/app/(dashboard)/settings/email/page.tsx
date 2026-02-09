'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useEmailAccounts, useDomainIdentities } from '@/hooks/use-email-accounts'
import { EmailAccountCard } from '@/components/email/email-account-card'
import { DomainVerification } from '@/components/email/domain-verification'
import { ConnectEmailDialog } from '@/components/email/connect-email-dialog'

export default function EmailSettingsPage() {
  const searchParams = useSearchParams()
  const { data: accounts, loading: accountsLoading, refetch: refetchAccounts } = useEmailAccounts()
  const { data: domains, loading: domainsLoading, refetch: refetchDomains } = useDomainIdentities()

  useEffect(() => {
    const connected = searchParams.get('connected')
    const error = searchParams.get('error')

    if (connected) {
      toast.success(`${connected} account connected successfully`)
      refetchAccounts()
    }
    if (error) {
      const messages: Record<string, string> = {
        oauth_denied: 'OAuth connection was denied',
        not_configured: 'OAuth provider is not configured',
        token_exchange_failed: 'Failed to exchange authorization code',
        callback_failed: 'Connection callback failed',
        userinfo_failed: 'Failed to get account information',
        profile_failed: 'Failed to get profile information',
        no_email: 'Could not determine email address from account',
      }
      toast.error(messages[error] || 'Connection failed')
    }
  }, [searchParams, refetchAccounts])

  const isLoading = accountsLoading || domainsLoading

  if (isLoading) {
    return (
      <div className="flex h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Email Accounts</h2>
          <p className="text-muted-foreground">
            Manage your email sending accounts and domain verification.
          </p>
        </div>
        <ConnectEmailDialog onSuccess={refetchAccounts} />
      </div>

      {accounts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-lg font-medium">No email accounts configured</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add an email account to start sending campaign emails.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {accounts.map((account) => (
            <EmailAccountCard
              key={account.id}
              account={account}
              onRefresh={refetchAccounts}
            />
          ))}
        </div>
      )}

      <DomainVerification domains={domains} onRefresh={refetchDomains} />
    </div>
  )
}
