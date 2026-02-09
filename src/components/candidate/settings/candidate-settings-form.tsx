'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2, Lock, Mail, Bell, Shield } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

type PasswordFormValues = z.infer<typeof passwordSchema>

interface CandidateSettingsFormProps {
  user: {
    id: string
    email: string
    emailVerified: boolean
  }
}

export function CandidateSettingsForm({ user }: CandidateSettingsFormProps) {
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [jobAlerts, setJobAlerts] = useState(true)
  const [interviewReminders, setInterviewReminders] = useState(true)

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  })

  async function onPasswordSubmit(data: PasswordFormValues) {
    setIsChangingPassword(true)

    try {
      const res = await fetch('/api/candidate/settings/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
        }),
      })

      if (!res.ok) {
        const result = await res.json()
        throw new Error(result.error || 'Failed to change password')
      }

      toast.success('Password changed!', {
        description: 'Your password has been updated successfully.',
      })

      passwordForm.reset()
    } catch (error) {
      console.error('Password change error:', error)
      toast.error('Failed to change password', {
        description: error instanceof Error ? error.message : 'Please try again',
      })
    } finally {
      setIsChangingPassword(false)
    }
  }

  async function saveEmailPreferences() {
    try {
      const res = await fetch('/api/candidate/settings/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailNotifications,
          jobAlerts,
          interviewReminders,
        }),
      })

      if (!res.ok) {
        throw new Error('Failed to save preferences')
      }

      toast.success('Preferences saved!', {
        description: 'Your email preferences have been updated.',
      })
    } catch (error) {
      toast.error('Failed to save preferences', {
        description: 'Please try again',
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Account Information */}
      <Card className="border-orange-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-900">
            <Shield className="h-5 w-5" />
            Account Information
          </CardTitle>
          <CardDescription>Your account details and status</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b">
            <div>
              <p className="text-sm font-medium text-gray-900">Email Address</p>
              <p className="text-sm text-gray-600">{user.email}</p>
            </div>
            {user.emailVerified ? (
              <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full">
                Verified
              </span>
            ) : (
              <span className="text-xs bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full">
                Unverified
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card className="border-orange-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-900">
            <Lock className="h-5 w-5" />
            Change Password
          </CardTitle>
          <CardDescription>Update your password to keep your account secure</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...passwordForm}>
            <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
              <FormField
                control={passwordForm.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Enter your current password"
                        className="focus-visible:ring-orange-500"
                        disabled={isChangingPassword}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={passwordForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Enter your new password"
                        className="focus-visible:ring-orange-500"
                        disabled={isChangingPassword}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Must be at least 8 characters with uppercase, lowercase, and numbers
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={passwordForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm New Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Confirm your new password"
                        className="focus-visible:ring-orange-500"
                        disabled={isChangingPassword}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="pt-4">
                <Button
                  type="submit"
                  className="bg-orange-600 hover:bg-orange-700"
                  disabled={isChangingPassword}
                >
                  {isChangingPassword ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Changing Password...
                    </>
                  ) : (
                    'Change Password'
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Email Preferences */}
      <Card className="border-orange-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-900">
            <Bell className="h-5 w-5" />
            Email Preferences
          </CardTitle>
          <CardDescription>Manage how we communicate with you</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Email Notifications</p>
              <p className="text-sm text-muted-foreground">
                Receive email notifications about your account activity
              </p>
            </div>
            <Switch
              checked={emailNotifications}
              onCheckedChange={setEmailNotifications}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Job Opportunity Alerts</p>
              <p className="text-sm text-muted-foreground">
                Get notified when employers reach out with opportunities
              </p>
            </div>
            <Switch
              checked={jobAlerts}
              onCheckedChange={setJobAlerts}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Interview Reminders</p>
              <p className="text-sm text-muted-foreground">
                Receive reminders about upcoming interviews
              </p>
            </div>
            <Switch
              checked={interviewReminders}
              onCheckedChange={setInterviewReminders}
            />
          </div>

          <div className="pt-4 border-t">
            <Button
              onClick={saveEmailPreferences}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Save Preferences
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
