'use client'

import { useState, useEffect, useCallback } from 'react'
import { useUser } from '@/hooks/use-user'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { companySchema, inviteTeamMemberSchema } from '@/lib/utils/validation'
import type { CompanyFormValues, InviteTeamMemberFormValues } from '@/lib/utils/validation'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Building2,
  Users,
  Globe,
  Loader2,
  Plus,
  Mail,
  Shield,
} from 'lucide-react'

interface TeamMember {
  id: string
  userId: string
  role: string
  createdAt: string
}

const COMPANY_SIZES = [
  { value: '1-10', label: '1-10 employees' },
  { value: '11-50', label: '11-50 employees' },
  { value: '51-200', label: '51-200 employees' },
  { value: '201-500', label: '201-500 employees' },
  { value: '501-1000', label: '501-1,000 employees' },
  { value: '1001-5000', label: '1,001-5,000 employees' },
  { value: '5000+', label: '5,000+ employees' },
]

const ROLE_BADGE_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  admin: 'default',
  recruiter: 'secondary',
  viewer: 'outline',
}

export default function CompanySettingsPage() {
  const { user, loading: isUserLoading } = useUser()
  const isLoaded = !isUserLoading
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [inviting, setInviting] = useState(false)

  const form = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: '',
      industry_sector: '',
      company_size: null,
      website: '',
    },
  })

  const inviteForm = useForm<InviteTeamMemberFormValues>({
    resolver: zodResolver(inviteTeamMemberSchema),
    defaultValues: {
      email: '',
      role: 'recruiter',
    },
  })

  const fetchCompanyData = useCallback(async () => {
    try {
      const res = await fetch('/api/company')
      if (!res.ok) {
        if (res.status === 401 || res.status === 404) {
          setLoading(false)
          return
        }
        throw new Error('Failed to fetch company data')
      }

      const data = await res.json()
      const company = data.company

      if (company) {
        setCompanyId(company.id)
        form.reset({
          name: company.name,
          industry_sector: company.industrySector ?? '',
          company_size: company.companySize as CompanyFormValues['company_size'],
          website: company.website ?? '',
        })
      }

      // Team members come from company_users via the company API
      // Since we don't have a dedicated team members endpoint,
      // we show basic info from the company_users data if available
      if (data.companyUsers) {
        setTeamMembers(data.companyUsers)
      }
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error loading company data:', err)
      }
      toast.error('Failed to load company settings')
    } finally {
      setLoading(false)
    }
  }, [form])

  useEffect(() => {
    if (isLoaded && user) {
      fetchCompanyData()
    } else if (isLoaded && !user) {
      setLoading(false)
    }
  }, [isLoaded, user, fetchCompanyData])

  async function onSubmit(values: CompanyFormValues) {
    setSaving(true)
    try {
      const isCreating = !companyId
      const res = await fetch('/api/company', {
        method: isCreating ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error ?? 'Failed to save company settings')
        if (process.env.NODE_ENV !== 'production') {
          console.error('Error saving company:', data.error)
        }
      } else {
        const data = await res.json()
        if (isCreating && data.companyId) {
          setCompanyId(data.companyId)
        }
        toast.success(isCreating ? 'Company created successfully' : 'Company settings saved successfully')
      }
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error saving company:', err)
      }
      toast.error('An unexpected error occurred')
    } finally {
      setSaving(false)
    }
  }

  async function onInvite(values: InviteTeamMemberFormValues) {
    if (!companyId) return

    setInviting(true)
    try {
      const res = await fetch('/api/company/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: values.email, role: values.role }),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error ?? 'Failed to send invitation')
        return
      }

      toast.success(`Invitation sent to ${values.email}`)
      inviteForm.reset({ email: '', role: 'recruiter' })
      setInviteDialogOpen(false)
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error sending invite:', err)
      }
      toast.error('Team invitations are not yet available. This feature is coming soon.')
    } finally {
      setInviting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Company Settings</h1>
        <p className="text-muted-foreground">
          Manage your company profile and team members.
        </p>
      </div>

      {/* Company Profile */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Company Profile</CardTitle>
          </div>
          <CardDescription>
            {companyId ? 'Update your company information visible across the platform.' : 'Set up your company profile to start using VerticalHire.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Acme Construction" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="industry_sector"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Industry Sector</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Commercial Construction"
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="company_size"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Size</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value ?? undefined}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select company size" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {COMPANY_SIZES.map((size) => (
                            <SelectItem key={size.value} value={size.value}>
                              {size.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            placeholder="https://www.example.com"
                            className="pl-9"
                            {...field}
                            value={field.value ?? ''}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {companyId ? 'Save Changes' : 'Create Company'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Separator />

      {/* Team Members */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle>Team Members</CardTitle>
                <CardDescription>
                  Manage who has access to your VerticalHire account.
                </CardDescription>
              </div>
            </div>
            <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Invite Team Member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite Team Member</DialogTitle>
                </DialogHeader>
                <Form {...inviteForm}>
                  <form
                    onSubmit={inviteForm.handleSubmit(onInvite)}
                    className="space-y-4"
                  >
                    <FormField
                      control={inviteForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Address</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              <Input
                                placeholder="colleague@company.com"
                                className="pl-9"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={inviteForm.control}
                      name="role"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Role</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a role" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="admin">
                                <div className="flex items-center gap-2">
                                  <Shield className="h-3.5 w-3.5" />
                                  Admin - Full access
                                </div>
                              </SelectItem>
                              <SelectItem value="recruiter">
                                <div className="flex items-center gap-2">
                                  <Users className="h-3.5 w-3.5" />
                                  Recruiter - Manage jobs &amp; candidates
                                </div>
                              </SelectItem>
                              <SelectItem value="viewer">
                                <div className="flex items-center gap-2">
                                  <Globe className="h-3.5 w-3.5" />
                                  Viewer - Read-only access
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end gap-2 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setInviteDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={inviting}>
                        {inviting && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Send Invitation
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamMembers.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={2}
                    className="text-center text-muted-foreground"
                  >
                    No team members found.
                  </TableCell>
                </TableRow>
              ) : (
                teamMembers.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <Badge
                        variant={ROLE_BADGE_VARIANT[member.role] ?? 'outline'}
                      >
                        {member.role.charAt(0).toUpperCase() +
                          member.role.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(member.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
