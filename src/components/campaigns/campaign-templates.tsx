'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Mail,
  Send,
  Clock,
  Heart,
  Briefcase,
  MessageSquare,
  Plus,
  Loader2,
  Eye,
  Trash2,
  Pencil,
  Save,
  X,
  FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
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
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CampaignTemplate {
  id: string
  name: string
  subject: string
  body: string
  isSystem: boolean
  createdAt: string
  updatedAt: string
}

interface CampaignTemplatesProps {
  onUseTemplate: (template: { subject: string; body: string }) => void
}

// ---------------------------------------------------------------------------
// Merge tag sample data for preview
// ---------------------------------------------------------------------------

const SAMPLE_DATA: Record<string, string> = {
  '{{candidate_name}}': 'Alex Johnson',
  '{{firstName}}': 'Alex',
  '{{lastName}}': 'Johnson',
  '{{job_title}}': 'Senior Software Engineer',
  '{{company_name}}': 'Acme Tech',
  '{{currentCompany}}': 'Globex Corp',
  '{{currentTitle}}': 'Software Engineer',
  '{{location}}': 'San Francisco, CA',
  '{{senderName}}': 'Jane Smith',
}

function renderPreview(text: string): string {
  let result = text
  for (const [tag, value] of Object.entries(SAMPLE_DATA)) {
    result = result.replaceAll(tag, value)
  }
  return result
}

// ---------------------------------------------------------------------------
// System templates
// ---------------------------------------------------------------------------

const SYSTEM_TEMPLATES: Omit<CampaignTemplate, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Interview Invitation',
    subject: 'Interview Opportunity at {{company_name}} - {{job_title}}',
    body: `Hi {{firstName}},

I came across your profile and was impressed by your experience at {{currentCompany}}. We have an exciting {{job_title}} opportunity at {{company_name}} that I think would be a great fit for your background.

Would you be open to a brief conversation to learn more about the role?

Looking forward to hearing from you.

Best regards,
{{senderName}}
{{company_name}}`,
    isSystem: true,
  },
  {
    name: 'Follow-Up',
    subject: 'Following up - {{job_title}} at {{company_name}}',
    body: `Hi {{firstName}},

I wanted to follow up on my previous message regarding the {{job_title}} position at {{company_name}}. I understand you might be busy, but I wanted to make sure this opportunity was on your radar.

The role offers a chance to work on challenging projects with a talented team. I would love to share more details if you are interested.

Would you have 15 minutes for a quick chat this week?

Best,
{{senderName}}`,
    isSystem: true,
  },
  {
    name: 'Thank You',
    subject: 'Thank you for your time, {{firstName}}',
    body: `Hi {{firstName}},

Thank you for taking the time to speak with us about the {{job_title}} position at {{company_name}}. It was great learning more about your experience and career goals.

We are currently reviewing all candidates and will be in touch soon with next steps.

In the meantime, please don't hesitate to reach out if you have any questions.

Warm regards,
{{senderName}}
{{company_name}}`,
    isSystem: true,
  },
  {
    name: 'Rejection (Respectful)',
    subject: 'Update on your application - {{company_name}}',
    body: `Hi {{firstName}},

Thank you for your interest in the {{job_title}} position at {{company_name}} and for taking the time to go through our interview process.

After careful consideration, we have decided to move forward with other candidates whose experience more closely aligns with our current needs. This was a difficult decision as we were impressed by your background.

We would love to keep your information on file for future opportunities that may be a better fit. We encourage you to apply again in the future.

Wishing you all the best in your career journey.

Sincerely,
{{senderName}}
{{company_name}}`,
    isSystem: true,
  },
  {
    name: 'Job Opening',
    subject: 'Exciting {{job_title}} opening at {{company_name}}',
    body: `Hi {{firstName}},

I hope this message finds you well. I am reaching out because we have a new {{job_title}} opening at {{company_name}} that aligns well with your skills and experience.

Here is a quick overview of what makes this role special:
- Competitive compensation and benefits
- Collaborative and innovative team environment
- Opportunities for growth and career development

If this sounds interesting, I would love to schedule a quick call to discuss the details. When would be a good time for you?

Best regards,
{{senderName}}
{{company_name}}`,
    isSystem: true,
  },
]

const TEMPLATE_ICONS: Record<string, typeof Mail> = {
  'Interview Invitation': Mail,
  'Follow-Up': Clock,
  'Thank You': Heart,
  'Rejection (Respectful)': MessageSquare,
  'Job Opening': Briefcase,
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CampaignTemplates({ onUseTemplate }: CampaignTemplatesProps) {
  const [templates, setTemplates] = useState<CampaignTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [previewTemplate, setPreviewTemplate] = useState<CampaignTemplate | null>(null)
  const [editingTemplate, setEditingTemplate] = useState<CampaignTemplate | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Form state for create/edit
  const [formName, setFormName] = useState('')
  const [formSubject, setFormSubject] = useState('')
  const [formBody, setFormBody] = useState('')

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/campaign-templates')
      if (res.ok) {
        const data = await res.json()
        setTemplates(data.templates || [])
      }
    } catch {
      // Templates will show system templates only
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  // Merge system templates with user templates
  const allTemplates: CampaignTemplate[] = [
    ...SYSTEM_TEMPLATES.map((t, i) => ({
      ...t,
      id: `system-${i}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })),
    ...templates,
  ]

  function handleUseTemplate(template: CampaignTemplate) {
    onUseTemplate({ subject: template.subject, body: template.body })
    toast.success(`Template "${template.name}" applied`)
  }

  function openCreate() {
    setFormName('')
    setFormSubject('')
    setFormBody('')
    setEditingTemplate(null)
    setCreateOpen(true)
  }

  function openEdit(template: CampaignTemplate) {
    setFormName(template.name)
    setFormSubject(template.subject)
    setFormBody(template.body)
    setEditingTemplate(template)
    setCreateOpen(true)
  }

  async function handleSave() {
    if (!formName.trim() || !formSubject.trim() || !formBody.trim()) {
      toast.error('Please fill in all fields')
      return
    }

    setSaving(true)
    try {
      if (editingTemplate && !editingTemplate.isSystem) {
        // Update existing
        const res = await fetch(
          `/api/campaign-templates/${editingTemplate.id}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: formName,
              subject: formSubject,
              body: formBody,
            }),
          }
        )
        if (!res.ok) throw new Error('Failed to update template')
        toast.success('Template updated')
      } else {
        // Create new
        const res = await fetch('/api/campaign-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formName,
            subject: formSubject,
            body: formBody,
          }),
        })
        if (!res.ok) throw new Error('Failed to create template')
        toast.success('Template created')
      }
      setCreateOpen(false)
      fetchTemplates()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(templateId: string) {
    setDeleting(templateId)
    try {
      const res = await fetch(`/api/campaign-templates/${templateId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete template')
      toast.success('Template deleted')
      fetchTemplates()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong'
      toast.error(message)
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Email Templates</h3>
          <p className="text-sm text-muted-foreground">
            Choose a template to pre-fill your campaign or create your own.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Create Template
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {allTemplates.map((template) => {
            const IconComp = TEMPLATE_ICONS[template.name] || FileText
            return (
              <Card
                key={template.id}
                className="group transition-colors hover:bg-accent/50"
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <IconComp className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-medium truncate">
                          {template.name}
                        </h4>
                        {template.isSystem && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            System
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {template.subject}
                      </p>
                      <div className="flex items-center gap-1 pt-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleUseTemplate(template)}
                        >
                          <Send className="h-3 w-3" />
                          Use
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setPreviewTemplate(template)}
                        >
                          <Eye className="h-3 w-3" />
                          Preview
                        </Button>
                        {!template.isSystem && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => openEdit(template)}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-destructive hover:text-destructive"
                              onClick={() => handleDelete(template.id)}
                              disabled={deleting === template.id}
                            >
                              {deleting === template.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Trash2 className="h-3 w-3" />
                              )}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Preview dialog */}
      <Dialog
        open={previewTemplate !== null}
        onOpenChange={(open) => !open && setPreviewTemplate(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Template Preview</DialogTitle>
            <DialogDescription>
              Preview with sample data. Merge tags will be replaced with real
              candidate data when the campaign is sent.
            </DialogDescription>
          </DialogHeader>
          {previewTemplate && (
            <div className="space-y-4">
              <div className="rounded-lg border p-4 space-y-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Subject
                  </p>
                  <p className="text-sm font-semibold">
                    {renderPreview(previewTemplate.subject)}
                  </p>
                </div>
                <Separator />
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Body
                  </p>
                  <div className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                    {renderPreview(previewTemplate.body)}
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPreviewTemplate(null)}
            >
              Close
            </Button>
            {previewTemplate && (
              <Button
                onClick={() => {
                  handleUseTemplate(previewTemplate)
                  setPreviewTemplate(null)
                }}
              >
                <Send className="h-4 w-4" />
                Use Template
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Edit Template' : 'Create Custom Template'}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate
                ? 'Update this template. Use merge tags like {{firstName}}, {{job_title}}, {{company_name}}.'
                : 'Create a reusable email template. Use merge tags like {{firstName}}, {{job_title}}, {{company_name}}.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="template-name">Template Name</Label>
              <Input
                id="template-name"
                placeholder="e.g., Technical Role Outreach"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="template-subject">Subject Line</Label>
              <Input
                id="template-subject"
                placeholder="e.g., Exciting opportunity at {{company_name}}"
                value={formSubject}
                onChange={(e) => setFormSubject(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="template-body">Email Body</Label>
              <Textarea
                id="template-body"
                placeholder="Write your email template..."
                value={formBody}
                onChange={(e) => setFormBody(e.target.value)}
                className="min-h-[200px]"
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">
                Available merge tags:
              </p>
              <div className="flex flex-wrap gap-1">
                {Object.keys(SAMPLE_DATA).map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="font-mono text-[10px] cursor-pointer"
                    onClick={() => setFormBody((b) => b + tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              <Save className="h-4 w-4" />
              {editingTemplate ? 'Save Changes' : 'Create Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
