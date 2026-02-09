'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2,
  Check,
  Star,
  Crown,
  Zap,
  ArrowRight,
  Users,
  Mail,
  Shield,
  Target,
  TrendingUp,
  Calendar,
  BarChart3,
  Clock,
  Award,
  Sparkles,
  HardHat,
  Search,
  MessageSquare,
  ChevronDown,
  Quote,
  DollarSign,
  Gauge,
  Building,
  Hammer,
  TrendingDown,
  Linkedin,
  FileText,
  Bot,
  Menu,
  X,
} from 'lucide-react'

function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const navLinks = [
    { label: 'Features', href: '#features' },
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'Use Cases', href: '#use-cases' },
    { label: 'Testimonials', href: '#testimonials' },
    { label: 'FAQ', href: '#faq' },
  ]

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-white/95 shadow-md backdrop-blur-md'
          : 'bg-transparent'
      }`}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl shadow-lg transition-all ${
              isScrolled
                ? 'bg-gradient-to-br from-indigo-600 to-purple-600'
                : 'bg-white'
            }`}
          >
            <Building2
              className={`h-6 w-6 ${isScrolled ? 'text-white' : 'text-indigo-600'}`}
            />
          </div>
          <span
            className={`text-xl font-bold tracking-tight ${
              isScrolled ? 'text-slate-900' : 'text-slate-900'
            }`}
          >
            VerticalHire
          </span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden items-center gap-8 lg:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-slate-700 transition-colors hover:text-indigo-600"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Desktop Actions */}
        <div className="hidden items-center gap-4 lg:flex">
          <Link
            href="/login"
            className="text-sm font-medium text-slate-700 transition-colors hover:text-slate-900"
          >
            Log In
          </Link>
          <Link
            href="/signup"
            className="inline-flex h-10 items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-6 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:shadow-indigo-500/25"
          >
            Get Started
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden"
        >
          {mobileMenuOpen ? (
            <X className="h-6 w-6 text-slate-700" />
          ) : (
            <Menu className="h-6 w-6 text-slate-700" />
          )}
        </button>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-t border-slate-200 bg-white lg:hidden"
          >
            <div className="mx-auto max-w-7xl space-y-1 px-6 py-4">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block rounded-lg px-4 py-3 text-base font-medium text-slate-700 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                >
                  {link.label}
                </a>
              ))}
              <div className="border-t border-slate-200 pt-4">
                <Link
                  href="/login"
                  className="block rounded-lg px-4 py-3 text-base font-medium text-slate-700 transition-colors hover:bg-slate-100"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Log In
                </Link>
                <Link
                  href="/signup"
                  className="mt-2 block rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 text-center text-base font-semibold text-white shadow-lg"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Get Started
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  )
}

function DashboardPreview() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.3 }}
      className="relative mx-auto max-w-5xl"
    >
      <div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 blur-3xl" />
      <div className="relative overflow-hidden rounded-2xl border border-white/20 bg-white/90 shadow-2xl backdrop-blur-sm">
        {/* Dashboard Header */}
        <div className="border-b border-slate-200 bg-white/50 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600">
                <Building2 className="h-6 w-6 text-white" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  Construction Recruiting Dashboard
                </div>
                <div className="text-xs text-slate-500">Good morning, Sarah</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-green-600" />
                  AI Active
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard Content */}
        <div className="p-6">
          <div className="mb-6 grid gap-4 md:grid-cols-4">
            {[
              {
                label: 'Active Jobs',
                value: '12',
                change: '+3',
                icon: Target,
                color: 'indigo',
              },
              {
                label: 'Candidates',
                value: '247',
                change: '+52',
                icon: Users,
                color: 'blue',
              },
              {
                label: 'Response Rate',
                value: '68%',
                change: '+12%',
                icon: TrendingUp,
                color: 'green',
              },
              {
                label: 'Time to Hire',
                value: '18d',
                change: '-4d',
                icon: Clock,
                color: 'orange',
              },
            ].map((stat, idx) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 + idx * 0.1 }}
                className="rounded-xl border border-slate-200 bg-white p-4"
              >
                <div className="mb-2 flex items-center justify-between">
                  <stat.icon className="h-5 w-5 text-indigo-600" />
                  <span className="text-xs font-medium text-green-600">
                    {stat.change}
                  </span>
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {stat.value}
                </div>
                <div className="text-xs text-slate-500">{stat.label}</div>
              </motion.div>
            ))}
          </div>

          {/* Recent Activity */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">
                  Top Candidates
                </h3>
                <Award className="h-4 w-4 text-indigo-600" />
              </div>
              <div className="space-y-2">
                {[
                  {
                    name: 'Michael Chen',
                    role: 'Project Manager',
                    score: 98,
                  },
                  {
                    name: 'Sarah Johnson',
                    role: 'Site Supervisor',
                    score: 94,
                  },
                  {
                    name: 'David Rodriguez',
                    role: 'Safety Director',
                    score: 92,
                  },
                ].map((candidate, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-lg bg-slate-50 p-2"
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600" />
                      <div>
                        <div className="text-xs font-medium text-slate-900">
                          {candidate.name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {candidate.role}
                        </div>
                      </div>
                    </div>
                    <div className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                      {candidate.score}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">
                  Campaign Performance
                </h3>
                <BarChart3 className="h-4 w-4 text-indigo-600" />
              </div>
              <div className="space-y-3">
                {[
                  { name: 'Senior PM Outreach', sent: 45, opened: 32 },
                  { name: 'Site Supervisor Campaign', sent: 38, opened: 26 },
                  { name: 'Safety Director Search', sent: 28, opened: 19 },
                ].map((campaign, idx) => (
                  <div key={idx}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">
                        {campaign.name}
                      </span>
                      <span className="text-slate-500">
                        {Math.round((campaign.opened / campaign.sent) * 100)}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-purple-600"
                        style={{
                          width: `${(campaign.opened / campaign.sent) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function HeroSection() {
  return (
    <section className="gradient-mesh grid-pattern relative overflow-hidden pb-24 pt-32 sm:pb-32 sm:pt-40 lg:pb-40 lg:pt-48">
      {/* Floating elements */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          animate={{
            y: [0, -20, 0],
            rotate: [0, 5, 0],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute left-[10%] top-[20%] h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl"
        />
        <motion.div
          animate={{
            y: [0, 20, 0],
            rotate: [0, -5, 0],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute right-[10%] top-[40%] h-96 w-96 rounded-full bg-purple-500/10 blur-3xl"
        />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white/80 px-4 py-1.5 text-sm font-medium text-indigo-700 shadow-sm backdrop-blur-sm"
          >
            <Sparkles className="h-4 w-4" />
            AI-Powered Construction Recruiting Platform
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-5xl font-bold tracking-tight text-slate-900 sm:text-6xl lg:text-7xl"
          >
            Build Your{' '}
            <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Dream Team
            </span>
            <br />
            Without Recruiters
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-6 text-lg leading-8 text-slate-700 sm:text-xl"
          >
            VerticalHire uses artificial intelligence to source, score, and
            engage top construction executives automatically. Reduce time-to-hire
            by 60% and save thousands on recruiting fees.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
          >
            <Link
              href="/signup"
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-8 text-base font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:shadow-indigo-500/25"
            >
              Start free trial
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-8 text-base font-semibold text-slate-900 transition-colors hover:border-indigo-600 hover:bg-indigo-50"
            >
              See How It Works
              <ChevronDown className="h-5 w-5" />
            </a>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-600"
          >
            <Check className="h-4 w-4 text-green-600" />
            No credit card required • 3 free job posts • Cancel anytime
          </motion.p>
        </div>

        {/* Dashboard Preview */}
        <div className="mt-16 lg:mt-24">
          <DashboardPreview />
        </div>

        {/* Social Proof */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mt-16 text-center"
        >
          <p className="mb-6 text-sm font-medium text-slate-600">
            Trusted by leading construction companies
          </p>
          <div className="flex flex-wrap items-center justify-center gap-12 opacity-50 grayscale">
            {[Building2, HardHat, Target, Shield].map((Icon, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 text-slate-700"
              >
                <Icon className="h-8 w-8" />
                <span className="text-lg font-bold">
                  {['BuildCorp', 'SitePro', 'ConstructX', 'SafetyFirst'][idx]}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}

const STATS = [
  {
    value: '60%',
    label: 'Faster Time-to-Hire',
    description: 'Fill positions in weeks, not months',
    icon: Clock,
  },
  {
    value: '$50K+',
    label: 'Average Savings Per Hire',
    description: 'Eliminate expensive recruiter fees',
    icon: DollarSign,
  },
  {
    value: '3x',
    label: 'Higher Response Rate',
    description: 'AI-personalized outreach works better',
    icon: TrendingUp,
  },
  {
    value: '92%',
    label: 'Customer Satisfaction',
    description: 'Rated excellent by construction firms',
    icon: Star,
  },
]

function StatsSection() {
  return (
    <section className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-2xl text-center"
        >
          <h2 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Real Results for Construction Companies
          </h2>
          <p className="mt-4 text-lg text-indigo-100">
            Join hundreds of construction firms who've transformed their hiring with AI
          </p>
        </motion.div>

        <div className="mx-auto mt-16 grid max-w-6xl gap-8 md:grid-cols-2 lg:grid-cols-4">
          {STATS.map((stat, idx) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className="relative overflow-hidden rounded-2xl border border-white/20 bg-white/10 p-8 text-center backdrop-blur-sm"
            >
              <stat.icon className="mx-auto h-12 w-12 text-white/80" />
              <div className="mt-4 text-5xl font-bold text-white">
                {stat.value}
              </div>
              <div className="mt-2 text-lg font-semibold text-white">
                {stat.label}
              </div>
              <p className="mt-1 text-sm text-indigo-100">
                {stat.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

const FEATURES = [
  {
    icon: Search,
    title: 'AI-Powered Sourcing',
    description:
      'Our AI scans LinkedIn and professional networks to find qualified construction executives matching your exact requirements. No manual searching needed.',
    color: 'indigo',
  },
  {
    icon: MessageSquare,
    title: 'Automated Outreach',
    description:
      'Craft personalized email campaigns that engage candidates at scale. AI-generated messages that feel personal, driving 3x higher response rates.',
    color: 'purple',
  },
  {
    icon: Target,
    title: 'Smart Candidate Scoring',
    description:
      'Every candidate is automatically scored and ranked by our AI. See at a glance who your top prospects are with detailed skills and experience analysis.',
    color: 'pink',
  },
  {
    icon: BarChart3,
    title: 'Pipeline Management',
    description:
      'Track candidates through your hiring pipeline with an intuitive Kanban board. Automate follow-ups and never lose track of great talent.',
    color: 'blue',
  },
  {
    icon: Calendar,
    title: 'Interview Scheduling',
    description:
      'Automated scheduling that syncs with your calendar. Send interview invites, reminders, and collect feedback all in one place.',
    color: 'green',
  },
  {
    icon: Bot,
    title: 'AI Resume Analysis',
    description:
      'Instantly analyze resumes for skills, experience, and fit. Get detailed breakdowns of qualifications and recommendations.',
    color: 'orange',
  },
]

function FeaturesSection() {
  return (
    <section id="features" className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-2xl text-center"
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-indigo-100 px-4 py-1.5 text-sm font-medium text-indigo-700">
            <Zap className="h-4 w-4" />
            Powerful Features
          </div>
          <h2 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Everything You Need to{' '}
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Hire Top Talent
            </span>
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Replace expensive recruiters with AI-powered tools built
            specifically for the construction industry.
          </p>
        </motion.div>

        <div className="mx-auto mt-16 grid max-w-6xl gap-8 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, idx) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              whileHover={{ y: -5, transition: { duration: 0.2 } }}
              className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition-all hover:shadow-lg"
            >
              <div className="absolute right-0 top-0 h-24 w-24 rounded-bl-full bg-indigo-50 opacity-50 transition-opacity group-hover:opacity-100" />
              <div className="relative mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg">
                <feature.icon className="h-6 w-6 text-white" />
              </div>
              <h3 className="relative text-lg font-semibold text-slate-900">
                {feature.title}
              </h3>
              <p className="relative mt-2 text-sm leading-6 text-slate-600">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

const STEPS = [
  {
    step: '01',
    title: 'Create a Job',
    description:
      'Define your ideal candidate profile and let our AI generate a compelling job description tailored to construction.',
    icon: Target,
  },
  {
    step: '02',
    title: 'AI Sources Candidates',
    description:
      'Our AI searches networks, scores candidates, and builds a ranked pipeline automatically while you focus on your business.',
    icon: Users,
  },
  {
    step: '03',
    title: 'Hire Top Talent',
    description:
      'Engage top candidates with personalized outreach, track progress, and close your next great hire in record time.',
    icon: Award,
  },
]

function HowItWorksSection() {
  return (
    <section id="how-it-works" className="bg-slate-50 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-2xl text-center"
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-purple-100 px-4 py-1.5 text-sm font-medium text-purple-700">
            <Sparkles className="h-4 w-4" />
            Simple Process
          </div>
          <h2 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Start Hiring in{' '}
            <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              3 Simple Steps
            </span>
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            From job posting to offer letter in days, not months.
          </p>
        </motion.div>

        <div className="mx-auto mt-16 grid max-w-5xl gap-12 md:grid-cols-3">
          {STEPS.map((item, index) => (
            <motion.div
              key={item.step}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.2 }}
              className="relative text-center"
            >
              {index < STEPS.length - 1 && (
                <div className="absolute right-0 top-12 hidden h-0.5 w-full translate-x-1/2 md:block">
                  <div className="h-full w-full bg-gradient-to-r from-indigo-200 to-purple-200" />
                </div>
              )}
              <div className="relative mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 shadow-lg">
                <item.icon className="h-12 w-12 text-white" />
                <div className="absolute -right-2 -top-2 flex h-10 w-10 items-center justify-center rounded-full bg-white text-sm font-bold text-slate-900 shadow-md">
                  {item.step}
                </div>
              </div>
              <h3 className="text-xl font-semibold text-slate-900">
                {item.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {item.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

const USE_CASES = [
  {
    title: 'Senior Project Managers',
    description: 'Find experienced PMs who can lead large-scale commercial construction projects',
    icon: Building,
    roles: ['Project Director', 'Senior PM', 'Construction Manager'],
  },
  {
    title: 'Site Supervisors',
    description: 'Hire skilled supervisors to manage day-to-day operations on your job sites',
    icon: HardHat,
    roles: ['Site Superintendent', 'Field Supervisor', 'Site Manager'],
  },
  {
    title: 'Safety Directors',
    description: 'Recruit safety professionals to ensure compliance and reduce workplace incidents',
    icon: Shield,
    roles: ['Safety Manager', 'HSE Director', 'Compliance Officer'],
  },
  {
    title: 'Estimators & Engineers',
    description: 'Source technical talent to accurately bid and execute construction projects',
    icon: FileText,
    roles: ['Chief Estimator', 'Civil Engineer', 'Structural Engineer'],
  },
]

function UseCasesSection() {
  return (
    <section id="use-cases" className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-2xl text-center"
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-orange-100 px-4 py-1.5 text-sm font-medium text-orange-700">
            <Hammer className="h-4 w-4" />
            Use Cases
          </div>
          <h2 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Built for{' '}
            <span className="bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
              Construction Roles
            </span>
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Whether you're hiring for commercial, residential, or infrastructure projects,
            VerticalHire has you covered.
          </p>
        </motion.div>

        <div className="mx-auto mt-16 grid max-w-6xl gap-8 md:grid-cols-2">
          {USE_CASES.map((useCase, idx) => (
            <motion.div
              key={useCase.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition-all hover:shadow-md"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-red-600 shadow-lg">
                  <useCase.icon className="h-7 w-7 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-slate-900">
                    {useCase.title}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">
                    {useCase.description}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {useCase.roles.map((role) => (
                      <span
                        key={role}
                        className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                      >
                        {role}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

const TESTIMONIALS = [
  {
    quote:
      "VerticalHire cut our time-to-hire from 3 months to 3 weeks. We filled 5 senior PM positions without paying a single recruiter fee. The ROI is incredible.",
    author: 'Michael Stevens',
    role: 'VP of Operations',
    company: 'BuildRight Construction',
    avatar: 'MS',
  },
  {
    quote:
      "The AI candidate scoring is a game-changer. We can instantly see who's qualified instead of manually reviewing hundreds of resumes. Saved us countless hours.",
    author: 'Jennifer Park',
    role: 'Hiring Manager',
    company: 'Metro Infrastructure',
    avatar: 'JP',
  },
  {
    quote:
      "We were skeptical about AI recruiting, but VerticalHire proved us wrong. The personalized outreach gets way better response rates than our old approach.",
    author: 'David Martinez',
    role: 'CEO',
    company: 'Apex Builders',
    avatar: 'DM',
  },
]

function TestimonialsSection() {
  return (
    <section id="testimonials" className="bg-slate-50 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-2xl text-center"
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-green-100 px-4 py-1.5 text-sm font-medium text-green-700">
            <Star className="h-4 w-4" />
            Testimonials
          </div>
          <h2 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Loved by{' '}
            <span className="bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
              Construction Leaders
            </span>
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            See what hiring managers are saying about VerticalHire
          </p>
        </motion.div>

        <div className="mx-auto mt-16 grid max-w-6xl gap-8 md:grid-cols-3">
          {TESTIMONIALS.map((testimonial, idx) => (
            <motion.div
              key={testimonial.author}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className="relative rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
            >
              <Quote className="mb-4 h-10 w-10 text-indigo-600/20" />
              <p className="text-sm leading-6 text-slate-700">
                "{testimonial.quote}"
              </p>
              <div className="mt-6 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 text-sm font-bold text-white">
                  {testimonial.avatar}
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    {testimonial.author}
                  </div>
                  <div className="text-xs text-slate-600">
                    {testimonial.role}, {testimonial.company}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}


const FAQS = [
  {
    question: 'How does AI sourcing work?',
    answer:
      'Our AI searches LinkedIn, professional networks, and construction industry databases to find candidates matching your job requirements. It analyzes profiles, scores candidates based on experience and skills, and automatically adds them to your pipeline.',
  },
  {
    question: 'Can I customize the AI-generated outreach messages?',
    answer:
      'Absolutely! While our AI generates personalized messages, you have full control to edit templates, add your company voice, and customize every campaign before sending.',
  },
  {
    question: 'What construction roles can VerticalHire help me hire?',
    answer:
      'VerticalHire works for all construction executive and management roles including Project Managers, Site Supervisors, Safety Directors, Estimators, Engineers, and more. Our AI is trained specifically on construction industry requirements.',
  },
  {
    question: 'How much can I save compared to traditional recruiters?',
    answer:
      'Traditional construction recruiters charge 20-30% of first-year salary (often $30K-$60K per hire). With VerticalHire, you pay a flat monthly fee regardless of how many people you hire, typically saving $40K-$50K per senior hire.',
  },
  {
    question: 'Do I need technical skills to use VerticalHire?',
    answer:
      'No technical skills required! VerticalHire is designed for hiring managers and HR professionals. The interface is intuitive, and our AI handles all the complex work automatically.',
  },
  {
    question: 'Can I cancel anytime?',
    answer:
      'Yes, absolutely. There are no long-term contracts. You can upgrade, downgrade, or cancel your subscription at any time with no penalties or fees.',
  },
]

function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <section id="faq" className="bg-slate-50 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-2xl text-center"
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-100 px-4 py-1.5 text-sm font-medium text-blue-700">
            <MessageSquare className="h-4 w-4" />
            FAQ
          </div>
          <h2 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Frequently Asked{' '}
            <span className="bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
              Questions
            </span>
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Everything you need to know about VerticalHire
          </p>
        </motion.div>

        <div className="mx-auto mt-16 max-w-3xl">
          {FAQS.map((faq, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.05 }}
              className="mb-4"
            >
              <button
                onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white p-6 text-left transition-all hover:border-indigo-600"
              >
                <span className="text-lg font-semibold text-slate-900">
                  {faq.question}
                </span>
                <ChevronDown
                  className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${
                    openIndex === idx ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {openIndex === idx && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden rounded-b-xl border border-t-0 border-slate-200 bg-white px-6 pb-6"
                >
                  <p className="pt-4 text-sm leading-6 text-slate-600">
                    {faq.answer}
                  </p>
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

function CTASection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 py-24 sm:py-32">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:4rem_4rem]" />
      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-2xl text-center"
        >
          <h2 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Ready to Transform Your Hiring?
          </h2>
          <p className="mt-6 text-lg leading-8 text-indigo-100">
            Join hundreds of construction companies using AI to hire faster,
            cheaper, and better. Start your free trial today.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/signup"
              className="group inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-white px-10 text-base font-semibold text-indigo-600 shadow-lg transition-all hover:bg-indigo-50"
            >
              Start free trial
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
          <p className="mt-6 flex items-center justify-center gap-2 text-sm text-indigo-100">
            <Check className="h-4 w-4" />
            No credit card required • Cancel anytime
          </p>
        </motion.div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 shadow-lg">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">
              VerticalHire
            </span>
          </div>
          <nav className="flex gap-8 text-sm text-slate-600">
            <Link
              href="/signup"
              className="transition-colors hover:text-slate-900"
            >
              Sign Up
            </Link>
            <Link
              href="/login"
              className="transition-colors hover:text-slate-900"
            >
              Log In
            </Link>
            <a
              href="#features"
              className="transition-colors hover:text-slate-900"
            >
              Features
            </a>
          </nav>
        </div>
        <div className="mt-8 border-t border-slate-200 pt-8 text-center text-sm text-slate-500">
          &copy; {new Date().getFullYear()} VerticalHire. All rights reserved.
        </div>
      </div>
    </footer>
  )
}

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <Navigation />
      <HeroSection />
      <StatsSection />
      <FeaturesSection />
      <HowItWorksSection />
      <UseCasesSection />
      <TestimonialsSection />
      <FAQSection />
      <CTASection />
      <Footer />
    </div>
  )
}
