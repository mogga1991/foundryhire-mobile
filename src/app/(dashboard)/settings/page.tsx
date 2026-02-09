'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@/hooks/use-user'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { User, Mail, Loader2, CheckCircle } from 'lucide-react'

const profileSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
})

type ProfileFormValues = z.infer<typeof profileSchema>

export default function ProfileSettingsPage() {
  const { user, loading: isUserLoading } = useUser()
  const isLoaded = !isUserLoading
  const [loading, setLoading] = useState(false)

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: '',
      email: '',
    },
  })

  useEffect(() => {
    if (user) {
      form.reset({
        name: user.name || '',
        email: user.email || '',
      })
    }
  }, [user, form])

  async function onSubmit(values: ProfileFormValues) {
    if (!user) return

    setLoading(true)
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: values.name }),
      })

      if (!res.ok) {
        throw new Error('Failed to update profile')
      }

      toast.success('Profile updated successfully')
    } catch (err) {
      console.error('Error updating profile:', err)
      toast.error('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (!isLoaded) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const userInitials = user?.name
    ? user.name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
    : user?.email?.[0]?.toUpperCase() || 'U'

  return (
    <div className="space-y-6">
      {/* Profile Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                Update your personal information and email address.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="John Doe"
                          className="pl-9"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormDescription>
                      This is your display name across the application.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          type="email"
                          placeholder="john@example.com"
                          className="pl-9"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormDescription>
                      Your email address for notifications and account recovery.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end">
                <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Separator />

      {/* Account Information */}
      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>
            View your account status and details.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Account Status</p>
              <p className="text-sm text-muted-foreground">
                Your account is active and in good standing
              </p>
            </div>
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              <span className="text-sm font-medium">Active</span>
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">Email Verification</p>
                <p className="text-sm text-muted-foreground">
                  Your email address has been verified
                </p>
              </div>
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                <span className="text-sm font-medium">Verified</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Security Section */}
      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
          <CardDescription>
            Manage your password and security settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Password</p>
              <p className="text-sm text-muted-foreground">
                Last changed: Never
              </p>
            </div>
            <Button variant="outline" size="sm" disabled>
              Change Password
            </Button>
          </div>

          <div className="rounded-lg border border-muted p-4">
            <p className="text-sm text-muted-foreground">
              Password change functionality coming soon.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
