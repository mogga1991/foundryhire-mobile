'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Globe, Mail, Server, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

type ConnectionType = 'domain' | 'gmail' | 'microsoft' | 'smtp'

const connectionOptions: {
  type: ConnectionType
  label: string
  description: string
  icon: typeof Globe
}[] = [
  {
    type: 'domain',
    label: 'Send from your domain',
    description: 'Verify your domain with DNS records. Best for deliverability.',
    icon: Globe,
  },
  {
    type: 'gmail',
    label: 'Connect Gmail',
    description: 'Send from your Gmail or Google Workspace account.',
    icon: Mail,
  },
  {
    type: 'microsoft',
    label: 'Connect Microsoft',
    description: 'Send from your Outlook or Microsoft 365 account.',
    icon: Mail,
  },
  {
    type: 'smtp',
    label: 'Custom SMTP',
    description: 'Connect any email provider via SMTP credentials.',
    icon: Server,
  },
]

function SmtpForm({ onSuccess }: { onSuccess: () => void }) {
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    host: '',
    port: '587',
    username: '',
    password: '',
    fromAddress: '',
    fromName: '',
    useTls: true,
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/email/connect/smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, port: Number(form.port) }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Failed to connect')
      }
      toast.success('SMTP account connected')
      onSuccess()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Connection failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="host">SMTP Host</Label>
          <Input
            id="host"
            placeholder="smtp.example.com"
            value={form.host}
            onChange={(e) => setForm({ ...form, host: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="port">Port</Label>
          <Input
            id="port"
            placeholder="587"
            value={form.port}
            onChange={(e) => setForm({ ...form, port: e.target.value })}
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="fromAddress">From Address</Label>
          <Input
            id="fromAddress"
            type="email"
            placeholder="you@example.com"
            value={form.fromAddress}
            onChange={(e) => setForm({ ...form, fromAddress: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fromName">From Name</Label>
          <Input
            id="fromName"
            placeholder="Your Name"
            value={form.fromName}
            onChange={(e) => setForm({ ...form, fromName: e.target.value })}
          />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Test & Connect
      </Button>
    </form>
  )
}

function DomainSetupInfo() {
  return (
    <div className="space-y-3 text-sm text-muted-foreground">
      <p>To send from your own domain:</p>
      <ol className="list-decimal space-y-1 pl-4">
        <li>Go to the Domain Verification section below</li>
        <li>Add your domain</li>
        <li>Configure the DNS records with your domain provider</li>
        <li>Click Verify to confirm the setup</li>
        <li>Create an email account using your verified domain</li>
      </ol>
    </div>
  )
}

export function ConnectEmailDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<ConnectionType | null>(null)
  const [connecting, setConnecting] = useState(false)

  async function handleOAuth(type: 'gmail' | 'microsoft') {
    setConnecting(true)
    try {
      const res = await fetch(`/api/email/connect/${type}`)
      if (!res.ok) throw new Error('Failed to initiate connection')
      const json = await res.json()
      window.location.href = json.url
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Connection failed')
      setConnecting(false)
    }
  }

  function handleSuccess() {
    setOpen(false)
    setSelected(null)
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSelected(null) }}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Email Account
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {selected ? 'Connect Email Account' : 'Choose Connection Type'}
          </DialogTitle>
        </DialogHeader>

        {!selected && (
          <div className="space-y-2">
            {connectionOptions.map((option) => {
              const Icon = option.icon
              return (
                <button
                  key={option.type}
                  onClick={() => {
                    if (option.type === 'gmail' || option.type === 'microsoft') {
                      handleOAuth(option.type)
                    } else {
                      setSelected(option.type)
                    }
                  }}
                  disabled={connecting}
                  className="flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-accent"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">{option.label}</p>
                    <p className="text-sm text-muted-foreground">{option.description}</p>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {selected === 'domain' && <DomainSetupInfo />}
        {selected === 'smtp' && <SmtpForm onSuccess={handleSuccess} />}

        {selected && (
          <Button variant="ghost" onClick={() => setSelected(null)}>
            Back
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}
