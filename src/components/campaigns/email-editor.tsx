'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Sparkles, Loader2, Eye, AlertCircle } from 'lucide-react'
import { useEmailAccounts } from '@/hooks/use-email-accounts'

const TEMPLATE_VARIABLES = [
  { key: '{{firstName}}', label: 'First Name', sample: 'John' },
  { key: '{{currentCompany}}', label: 'Current Company', sample: 'Acme Corp' },
  { key: '{{jobTitle}}', label: 'Job Title', sample: 'Senior Software Engineer' },
  { key: '{{location}}', label: 'Location', sample: 'San Francisco, CA' },
]

interface EmailEditorProps {
  subject: string
  body: string
  onSubjectChange: (subject: string) => void
  onBodyChange: (body: string) => void
  onGenerateWithAI?: () => void
  isGenerating?: boolean
  showGenerateButton?: boolean
  emailAccountId?: string | null
  onEmailAccountChange?: (accountId: string) => void
  showEmailAccountSelector?: boolean
}

const typeLabels: Record<string, string> = {
  esp: 'Domain',
  gmail_oauth: 'Gmail',
  microsoft_oauth: 'Microsoft',
  smtp: 'SMTP',
}

export function EmailEditor({
  subject,
  body,
  onSubjectChange,
  onBodyChange,
  onGenerateWithAI,
  isGenerating = false,
  showGenerateButton = true,
  emailAccountId,
  onEmailAccountChange,
  showEmailAccountSelector = false,
}: EmailEditorProps) {
  const [isPreview, setIsPreview] = useState(false)
  const { data: emailAccounts, loading: accountsLoading } = useEmailAccounts()

  const insertVariable = (variable: string) => {
    onBodyChange(body + variable)
  }

  const getPreviewText = (text: string): string => {
    let preview = text
    for (const v of TEMPLATE_VARIABLES) {
      preview = preview.replaceAll(v.key, v.sample)
    }
    return preview
  }

  const bodyCharCount = body.length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">Email Content</Label>
        <div className="flex items-center gap-2">
          {showGenerateButton && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onGenerateWithAI}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate with AI
                </>
              )}
            </Button>
          )}
          <Button
            type="button"
            variant={isPreview ? 'default' : 'outline'}
            size="sm"
            onClick={() => setIsPreview(!isPreview)}
          >
            <Eye className="h-4 w-4" />
            {isPreview ? 'Edit' : 'Preview'}
          </Button>
        </div>
      </div>

      <Separator />

      {isPreview ? (
        <div className="space-y-4 rounded-lg border p-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Subject</p>
            <p className="text-sm font-semibold">{getPreviewText(subject)}</p>
          </div>
          <Separator />
          <div>
            <p className="text-sm font-medium text-muted-foreground">Body</p>
            <div className="mt-1 whitespace-pre-wrap text-sm">
              {getPreviewText(body)}
            </div>
          </div>
        </div>
      ) : (
        <>
          {showEmailAccountSelector && (
            <div className="space-y-2">
              <Label htmlFor="email-account">Send From</Label>
              {accountsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading accounts...
                </div>
              ) : emailAccounts.length === 0 ? (
                <div className="flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <span className="text-yellow-800">
                    No email accounts configured.{' '}
                    <a href="/settings/email" className="underline">
                      Set up an email account
                    </a>{' '}
                    to send campaigns.
                  </span>
                </div>
              ) : (
                <Select
                  value={emailAccountId || ''}
                  onValueChange={(val) => onEmailAccountChange?.(val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select email account" />
                  </SelectTrigger>
                  <SelectContent>
                    {emailAccounts
                      .filter((a) => a.status === 'active')
                      .map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.fromAddress} ({typeLabels[account.type] || account.type})
                          {account.isDefault ? ' - Default' : ''}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email-subject">Subject Line</Label>
            <Input
              id="email-subject"
              placeholder="Enter email subject..."
              value={subject}
              onChange={(e) => onSubjectChange(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="email-body">Email Body</Label>
              <span className="text-xs text-muted-foreground">{bodyCharCount} characters</span>
            </div>
            <Textarea
              id="email-body"
              placeholder="Write your outreach email..."
              value={body}
              onChange={(e) => onBodyChange(e.target.value)}
              className="min-h-[200px]"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Insert Template Variable</Label>
            <div className="flex flex-wrap gap-2">
              {TEMPLATE_VARIABLES.map((v) => (
                <Button
                  key={v.key}
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => insertVariable(v.key)}
                  className="font-mono text-xs"
                >
                  {v.key}
                </Button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
