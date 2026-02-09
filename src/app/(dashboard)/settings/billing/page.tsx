'use client'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Check,
  Star,
  Crown,
  Shield,
  MessageSquare,
  Calendar,
  Sparkles,
} from 'lucide-react'

interface PlanTier {
  id: 'starter' | 'business' | 'enterprise'
  name: string
  price: string
  icon: React.ComponentType<{ className?: string }>
  description: string
  features: string[]
  limits: {
    activeJobs: string
    candidatesPerMonth: string
  }
  highlighted?: boolean
}

const PLAN_TIERS: PlanTier[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 'Contact Us',
    icon: Shield,
    description: 'Perfect for small businesses just getting started with recruiting',
    features: [
      '2 active job postings',
      '10 candidates per month',
      'Basic AI candidate matching',
      'Email campaigns',
      'Interview scheduling',
      'Standard support',
    ],
    limits: {
      activeJobs: '2',
      candidatesPerMonth: '10',
    },
  },
  {
    id: 'business',
    name: 'Business',
    price: 'Contact Us',
    icon: Star,
    description: 'Best value for growing businesses that need more hiring power',
    features: [
      '10 active job postings',
      '100 candidates per month',
      'Advanced AI matching & scoring',
      'Unlimited email campaigns',
      'Video interview integration',
      'Priority support',
      'Custom branding',
      'Team collaboration',
    ],
    limits: {
      activeJobs: '10',
      candidatesPerMonth: '100',
    },
    highlighted: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Contact Us',
    icon: Crown,
    description: 'Complete solution for large teams with advanced requirements',
    features: [
      'Unlimited job postings',
      'Unlimited candidates',
      'Full AI suite with custom models',
      'Dedicated account manager',
      'Custom integrations & API access',
      'SLA guarantee',
      'White-label options',
      'Advanced analytics & reporting',
      'SSO & advanced security',
    ],
    limits: {
      activeJobs: 'Unlimited',
      candidatesPerMonth: 'Unlimited',
    },
  },
]

export default function BillingPage() {
  const handleContactUs = (planName: string) => {
    // You can replace this with your preferred contact method:
    // - Open a modal with a contact form
    // - Redirect to Calendly
    // - Open mailto
    // - Redirect to a contact page

    // Example: Open email
    window.location.href = `mailto:sales@verticalhire.com?subject=Interested in ${planName} Plan&body=Hi, I'm interested in learning more about the ${planName} plan for VerticalHire.`

    // Alternative: Redirect to Calendly (uncomment and update with your link)
    // window.open('https://calendly.com/your-team/demo', '_blank')
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Plans & Pricing</h1>
        <p className="text-muted-foreground">
          Choose the perfect plan for your hiring needs. Start with a free trial today.
        </p>
      </div>

      {/* Free Trial CTA */}
      <Card className="border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Start Your Free Trial
                </h3>
                <p className="text-sm text-slate-700 mt-1">
                  Experience the full power of AI-driven recruiting. No credit card required.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                size="lg"
                onClick={() => handleContactUs('Free Trial')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                <Calendar className="mr-2 h-4 w-4" />
                Schedule a Demo
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => handleContactUs('General Inquiry')}
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                Contact Sales
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Plan Tiers */}
      <div>
        <h2 className="mb-6 text-xl font-semibold tracking-tight">
          Compare Plans
        </h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {PLAN_TIERS.map((tier) => {
            return (
              <Card
                key={tier.id}
                className={
                  tier.highlighted
                    ? 'relative border-indigo-600 shadow-lg'
                    : 'relative'
                }
              >
                {tier.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-indigo-600 text-white hover:bg-indigo-700">
                      Most Popular
                    </Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-4">
                  <tier.icon
                    className={`mx-auto h-10 w-10 mb-3 ${
                      tier.highlighted
                        ? 'text-indigo-600'
                        : 'text-muted-foreground'
                    }`}
                  />
                  <CardTitle className="text-xl">{tier.name}</CardTitle>
                  <div className="flex items-baseline justify-center gap-1 mt-2">
                    <span className="text-2xl font-bold text-indigo-600">
                      {tier.price}
                    </span>
                  </div>
                  <CardDescription className="mt-2">
                    {tier.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 min-h-[200px]">
                    {tier.features.map((feature) => (
                      <div key={feature} className="flex items-start gap-2 text-sm">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2">
                    <Button
                      className="w-full"
                      variant={tier.highlighted ? 'default' : 'outline'}
                      onClick={() => handleContactUs(tier.name)}
                    >
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Talk to Us
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      <Separator />

      {/* Why Choose Us */}
      <Card>
        <CardHeader>
          <CardTitle>Why Choose VerticalHire?</CardTitle>
          <CardDescription>
            Built specifically for construction and skilled trades recruiting
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100">
                <Sparkles className="h-5 w-5 text-indigo-600" />
              </div>
              <h3 className="font-semibold">AI-Powered Matching</h3>
              <p className="text-sm text-muted-foreground">
                Advanced AI analyzes resumes, LinkedIn profiles, and job requirements to find the perfect candidates.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                <Calendar className="h-5 w-5 text-green-600" />
              </div>
              <h3 className="font-semibold">Smart Scheduling</h3>
              <p className="text-sm text-muted-foreground">
                Automated interview scheduling with candidate self-service portal and calendar integration.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                <MessageSquare className="h-5 w-5 text-purple-600" />
              </div>
              <h3 className="font-semibold">Multi-Channel Outreach</h3>
              <p className="text-sm text-muted-foreground">
                Reach candidates through email campaigns with tracking, personalization, and automated follow-ups.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact Section */}
      <Card className="border-slate-200 bg-slate-50">
        <CardContent className="p-8">
          <div className="text-center space-y-4">
            <h3 className="text-xl font-semibold">Ready to Transform Your Hiring?</h3>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Join forward-thinking companies using AI to hire faster and smarter.
              Schedule a personalized demo to see how VerticalHire can work for your team.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button
                size="lg"
                onClick={() => handleContactUs('Demo Request')}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                <Calendar className="mr-2 h-5 w-5" />
                Schedule a Demo
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => handleContactUs('Sales Inquiry')}
              >
                <MessageSquare className="mr-2 h-5 w-5" />
                Talk to Sales
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Have questions? Email us at{' '}
              <a href="mailto:sales@verticalhire.com" className="text-indigo-600 hover:underline">
                sales@verticalhire.com
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
