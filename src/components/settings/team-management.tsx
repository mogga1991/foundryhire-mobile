'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import {
  Search,
  UserPlus,
  MoreHorizontal,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Users,
  Eye,
  Loader2,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Mail,
  ArrowUpDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TeamRole = 'owner' | 'admin' | 'recruiter' | 'interviewer' | 'viewer'
type MemberStatus = 'active' | 'invited' | 'deactivated'
type SortField = 'name' | 'role' | 'lastActive'
type SortDirection = 'asc' | 'desc'

interface TeamMember {
  id: string
  name: string
  email: string
  role: TeamRole
  status: MemberStatus
  lastActive: string | null
  avatarUrl: string | null
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const roleConfig: Record<TeamRole, { label: string; color: string; bgColor: string }> = {
  owner: { label: 'Owner', color: 'text-purple-700', bgColor: 'bg-purple-100 border-purple-200' },
  admin: { label: 'Admin', color: 'text-blue-700', bgColor: 'bg-blue-100 border-blue-200' },
  recruiter: { label: 'Recruiter', color: 'text-green-700', bgColor: 'bg-green-100 border-green-200' },
  interviewer: { label: 'Interviewer', color: 'text-yellow-700', bgColor: 'bg-yellow-100 border-yellow-200' },
  viewer: { label: 'Viewer', color: 'text-gray-700', bgColor: 'bg-gray-100 border-gray-200' },
}

const statusConfig: Record<MemberStatus, { label: string; color: string; dotColor: string }> = {
  active: { label: 'Active', color: 'text-green-700', dotColor: 'bg-green-500' },
  invited: { label: 'Invited', color: 'text-amber-700', dotColor: 'bg-amber-500' },
  deactivated: { label: 'Deactivated', color: 'text-gray-500', dotColor: 'bg-gray-400' },
}

const rolePermissions: Record<string, Record<TeamRole, boolean>> = {
  'Manage Jobs': { owner: true, admin: true, recruiter: true, interviewer: false, viewer: false },
  'View Candidates': { owner: true, admin: true, recruiter: true, interviewer: true, viewer: true },
  'Manage Candidates': { owner: true, admin: true, recruiter: true, interviewer: false, viewer: false },
  'Conduct Interviews': { owner: true, admin: true, recruiter: true, interviewer: true, viewer: false },
  'Manage Campaigns': { owner: true, admin: true, recruiter: true, interviewer: false, viewer: false },
  'Manage Settings': { owner: true, admin: true, recruiter: false, interviewer: false, viewer: false },
  'Manage Team': { owner: true, admin: true, recruiter: false, interviewer: false, viewer: false },
  'View Analytics': { owner: true, admin: true, recruiter: true, interviewer: false, viewer: true },
  'Billing & Subscription': { owner: true, admin: false, recruiter: false, interviewer: false, viewer: false },
}

const assignableRoles: TeamRole[] = ['admin', 'recruiter', 'interviewer', 'viewer']

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return 'Never'
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMinutes < 1) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getInitials(name: string): string {
  const parts = name.trim().split(' ')
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

// ---------------------------------------------------------------------------
// Skeleton component
// ---------------------------------------------------------------------------

function TeamTableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-3">
          <div className="h-9 w-9 animate-pulse rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
            <div className="h-3 w-48 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-6 w-16 animate-pulse rounded-full bg-muted" />
          <div className="h-6 w-16 animate-pulse rounded-full bg-muted" />
          <div className="h-4 w-20 animate-pulse rounded bg-muted" />
          <div className="h-8 w-8 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Role Badge
// ---------------------------------------------------------------------------

function RoleBadge({ role }: { role: TeamRole }) {
  const config = roleConfig[role]
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        config.bgColor,
        config.color
      )}
    >
      {config.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Status Indicator
// ---------------------------------------------------------------------------

function StatusIndicator({ status }: { status: MemberStatus }) {
  const config = statusConfig[status]
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', config.color)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', config.dotColor)} />
      {config.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Invite Member Dialog
// ---------------------------------------------------------------------------

function InviteMemberDialog({
  open,
  onOpenChange,
  onInvite,
  pendingCount,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onInvite: (email: string, role: TeamRole, message: string) => Promise<void>
  pendingCount: number
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<TeamRole>('recruiter')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [emailError, setEmailError] = useState('')

  function validateEmail(value: string): boolean {
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return pattern.test(value)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setEmailError('')

    if (!email.trim()) {
      setEmailError('Email is required')
      return
    }
    if (!validateEmail(email.trim())) {
      setEmailError('Please enter a valid email address')
      return
    }

    setSending(true)
    try {
      await onInvite(email.trim(), role, message.trim())
      setEmail('')
      setRole('recruiter')
      setMessage('')
      onOpenChange(false)
    } catch {
      // Error toast handled by parent
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>
            Send an invitation to join your team.
            {pendingCount > 0 && (
              <span className="ml-1 text-amber-600">
                {pendingCount} pending invitation{pendingCount !== 1 ? 's' : ''}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="invite-email"
                type="email"
                placeholder="colleague@company.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (emailError) setEmailError('')
                }}
                className={cn('pl-9', emailError && 'border-red-500')}
                aria-invalid={!!emailError}
                aria-describedby={emailError ? 'email-error' : undefined}
              />
            </div>
            {emailError && (
              <p id="email-error" className="text-xs text-red-600">
                {emailError}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-role">Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as TeamRole)}>
              <SelectTrigger id="invite-role" className="w-full">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {assignableRoles.map((r) => (
                  <SelectItem key={r} value={r}>
                    <span className="flex items-center gap-2">
                      <RoleBadge role={r} />
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-message">
              Personal message <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="invite-message"
              placeholder="Add a personal note to the invitation..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={sending}>
              {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send Invitation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Edit Member Dialog
// ---------------------------------------------------------------------------

function EditMemberDialog({
  member,
  open,
  onOpenChange,
  onUpdate,
  onDeactivate,
}: {
  member: TeamMember | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate: (id: string, role: TeamRole) => Promise<void>
  onDeactivate: (id: string) => Promise<void>
}) {
  const [role, setRole] = useState<TeamRole>(member?.role ?? 'viewer')
  const [saving, setSaving] = useState(false)
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false)
  const [deactivating, setDeactivating] = useState(false)

  useEffect(() => {
    if (member) {
      setRole(member.role)
      setShowDeactivateConfirm(false)
    }
  }, [member])

  if (!member) return null

  const isOwner = member.role === 'owner'

  async function handleSave() {
    if (!member || isOwner) return
    setSaving(true)
    try {
      await onUpdate(member.id, role)
      onOpenChange(false)
    } catch {
      // Error toast handled by parent
    } finally {
      setSaving(false)
    }
  }

  async function handleDeactivate() {
    if (!member) return
    setDeactivating(true)
    try {
      await onDeactivate(member.id)
      onOpenChange(false)
      setShowDeactivateConfirm(false)
    } catch {
      // Error toast handled by parent
    } finally {
      setDeactivating(false)
    }
  }

  // Find role-specific permissions for preview
  const currentRolePerms = Object.entries(rolePermissions).map(([perm, roles]) => ({
    permission: perm,
    allowed: roles[role],
  }))

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Team Member</DialogTitle>
            <DialogDescription>
              Update role and permissions for {member.name || member.email}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Member info */}
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 text-sm font-medium text-white">
                {getInitials(member.name || member.email)}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{member.name || 'Pending'}</p>
                <p className="text-xs text-muted-foreground">{member.email}</p>
              </div>
              <StatusIndicator status={member.status} />
            </div>

            {/* Role selector */}
            <div className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              {isOwner ? (
                <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm">
                  <ShieldAlert className="h-4 w-4 text-purple-600" />
                  <span>Owner role cannot be changed</span>
                </div>
              ) : (
                <Select value={role} onValueChange={(v) => setRole(v as TeamRole)}>
                  <SelectTrigger id="edit-role" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {assignableRoles.map((r) => (
                      <SelectItem key={r} value={r}>
                        {roleConfig[r].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Permissions summary */}
            <div className="space-y-2">
              <Label>Permissions for {roleConfig[role].label}</Label>
              <div className="rounded-lg border">
                <div className="max-h-48 overflow-y-auto">
                  {currentRolePerms.map(({ permission, allowed }) => (
                    <div
                      key={permission}
                      className="flex items-center justify-between border-b px-3 py-2 text-sm last:border-b-0"
                    >
                      <span className="text-muted-foreground">{permission}</span>
                      {allowed ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <X className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <div>
              {!isOwner && member.status !== 'deactivated' && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeactivateConfirm(true)}
                >
                  Deactivate
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              {!isOwner && (
                <Button onClick={handleSave} disabled={saving || role === member.role}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Confirmation */}
      <AlertDialog open={showDeactivateConfirm} onOpenChange={setShowDeactivateConfirm}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Member?</AlertDialogTitle>
            <AlertDialogDescription>
              This will revoke access for {member.name || member.email}. They will no longer be
              able to sign in or access any team resources.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDeactivate}
              disabled={deactivating}
            >
              {deactivating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ---------------------------------------------------------------------------
// Role Permissions Summary
// ---------------------------------------------------------------------------

function RolePermissionsSummary() {
  const [expanded, setExpanded] = useState(false)
  const roles: TeamRole[] = ['owner', 'admin', 'recruiter', 'interviewer', 'viewer']

  return (
    <Card>
      <CardHeader
        className="cursor-pointer"
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label="Toggle role permissions summary"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setExpanded(!expanded)
          }
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Role Permissions</CardTitle>
            <CardDescription>See what each role can do</CardDescription>
          </div>
          {expanded ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      </CardHeader>

      {expanded && (
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px]">Permission</TableHead>
                  {roles.map((r) => (
                    <TableHead key={r} className="text-center">
                      <RoleBadge role={r} />
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(rolePermissions).map(([perm, perms]) => (
                  <TableRow key={perm}>
                    <TableCell className="font-medium text-muted-foreground">
                      {perm}
                    </TableCell>
                    {roles.map((r) => (
                      <TableCell key={r} className="text-center">
                        {perms[r] ? (
                          <Check className="mx-auto h-4 w-4 text-green-600" />
                        ) : (
                          <X className="mx-auto h-4 w-4 text-gray-300" />
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Main TeamManagement Component
// ---------------------------------------------------------------------------

export function TeamManagement() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [editMember, setEditMember] = useState<TeamMember | null>(null)
  const [editOpen, setEditOpen] = useState(false)

  // Fetch members
  const fetchMembers = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/team/members')
      if (!res.ok) throw new Error('Failed to fetch team members')
      const data = await res.json()
      setMembers(data.members ?? data ?? [])
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error fetching team members:', err)
      }
      setError('Failed to load team members. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  // Invite handler
  async function handleInvite(email: string, role: TeamRole, message: string) {
    const res = await fetch('/api/team/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role, message }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to send invitation' }))
      toast.error(err.error || 'Failed to send invitation')
      throw new Error(err.error)
    }
    const data = await res.json()
    // Optimistic: add to list
    setMembers((prev) => [
      ...prev,
      data.member ?? {
        id: data.id ?? `temp-${Date.now()}`,
        name: '',
        email,
        role,
        status: 'invited' as MemberStatus,
        lastActive: null,
        avatarUrl: null,
      },
    ])
    toast.success(`Invitation sent to ${email}`)
  }

  // Update role handler
  async function handleUpdateRole(id: string, role: TeamRole) {
    // Optimistic update
    const prev = members
    setMembers((m) => m.map((member) => (member.id === id ? { ...member, role } : member)))

    const res = await fetch(`/api/team/members/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    if (!res.ok) {
      setMembers(prev) // Rollback
      const err = await res.json().catch(() => ({ error: 'Failed to update role' }))
      toast.error(err.error || 'Failed to update role')
      throw new Error(err.error)
    }
    toast.success('Role updated successfully')
  }

  // Deactivate handler
  async function handleDeactivate(id: string) {
    const prev = members
    setMembers((m) =>
      m.map((member) =>
        member.id === id ? { ...member, status: 'deactivated' as MemberStatus } : member
      )
    )

    const res = await fetch(`/api/team/members/${id}`, {
      method: 'DELETE',
    })
    if (!res.ok) {
      setMembers(prev) // Rollback
      const err = await res.json().catch(() => ({ error: 'Failed to deactivate member' }))
      toast.error(err.error || 'Failed to deactivate member')
      throw new Error(err.error)
    }
    toast.success('Member deactivated')
  }

  // Sort handler
  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  // Filtered + sorted members
  const filteredMembers = useMemo(() => {
    let result = members

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q)
      )
    }

    // Sort
    result = [...result].sort((a, b) => {
      const dir = sortDirection === 'asc' ? 1 : -1
      switch (sortField) {
        case 'name':
          return dir * (a.name || a.email).localeCompare(b.name || b.email)
        case 'role': {
          const roleOrder: Record<TeamRole, number> = {
            owner: 0,
            admin: 1,
            recruiter: 2,
            interviewer: 3,
            viewer: 4,
          }
          return dir * (roleOrder[a.role] - roleOrder[b.role])
        }
        case 'lastActive': {
          const aTime = a.lastActive ? new Date(a.lastActive).getTime() : 0
          const bTime = b.lastActive ? new Date(b.lastActive).getTime() : 0
          return dir * (aTime - bTime)
        }
        default:
          return 0
      }
    })

    return result
  }, [members, search, sortField, sortDirection])

  const pendingCount = members.filter((m) => m.status === 'invited').length

  // Sort button component
  function SortButton({ field, children }: { field: SortField; children: React.ReactNode }) {
    const isActive = sortField === field
    return (
      <button
        type="button"
        onClick={() => handleSort(field)}
        className="inline-flex items-center gap-1 hover:text-foreground"
        aria-label={`Sort by ${field}`}
      >
        {children}
        {isActive ? (
          sortDirection === 'asc' ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>
                Manage your team members and their access levels.
                {members.length > 0 && (
                  <span className="ml-1">
                    {members.filter((m) => m.status === 'active').length} active member
                    {members.filter((m) => m.status === 'active').length !== 1 ? 's' : ''}
                  </span>
                )}
              </CardDescription>
            </div>
            <Button onClick={() => setInviteOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Invite Member
              {pendingCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {pendingCount} pending
                </Badge>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="mb-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                aria-label="Search team members"
              />
            </div>
          </div>

          {/* Error state */}
          {error && (
            <div className="flex flex-col items-center justify-center rounded-lg border border-red-200 bg-red-50 py-8 text-center">
              <ShieldAlert className="mb-2 h-8 w-8 text-red-400" />
              <p className="text-sm font-medium text-red-700">{error}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={fetchMembers}>
                Try Again
              </Button>
            </div>
          )}

          {/* Loading state */}
          {loading && !error && <TeamTableSkeleton />}

          {/* Empty state */}
          {!loading && !error && filteredMembers.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">
                {search ? 'No members match your search' : 'No team members yet'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                {search
                  ? 'Try a different search term'
                  : 'Invite your first team member to get started'}
              </p>
              {!search && (
                <Button size="sm" className="mt-4" onClick={() => setInviteOpen(true)}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Invite Member
                </Button>
              )}
            </div>
          )}

          {/* Members table */}
          {!loading && !error && filteredMembers.length > 0 && (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <SortButton field="name">Name</SortButton>
                    </TableHead>
                    <TableHead className="hidden sm:table-cell">Email</TableHead>
                    <TableHead>
                      <SortButton field="role">Role</SortButton>
                    </TableHead>
                    <TableHead className="hidden md:table-cell">Status</TableHead>
                    <TableHead className="hidden lg:table-cell">
                      <SortButton field="lastActive">Last Active</SortButton>
                    </TableHead>
                    <TableHead className="w-10">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMembers.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 text-xs font-medium text-white">
                            {getInitials(member.name || member.email)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {member.name || 'Pending'}
                            </p>
                            <p className="truncate text-xs text-muted-foreground sm:hidden">
                              {member.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                        {member.email}
                      </TableCell>
                      <TableCell>
                        <RoleBadge role={member.role} />
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <StatusIndicator status={member.status} />
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                        {formatRelativeTime(member.lastActive)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              aria-label={`Actions for ${member.name || member.email}`}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setEditMember(member)
                                setEditOpen(true)
                              }}
                            >
                              <Shield className="mr-2 h-4 w-4" />
                              Edit Role
                            </DropdownMenuItem>
                            {member.role !== 'owner' && member.status !== 'deactivated' && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => {
                                    setEditMember(member)
                                    setEditOpen(true)
                                  }}
                                >
                                  <ShieldAlert className="mr-2 h-4 w-4" />
                                  Deactivate
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Role Permissions Summary */}
      <RolePermissionsSummary />

      {/* Invite Dialog */}
      <InviteMemberDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onInvite={handleInvite}
        pendingCount={pendingCount}
      />

      {/* Edit Dialog */}
      <EditMemberDialog
        member={editMember}
        open={editOpen}
        onOpenChange={setEditOpen}
        onUpdate={handleUpdateRole}
        onDeactivate={handleDeactivate}
      />
    </div>
  )
}
