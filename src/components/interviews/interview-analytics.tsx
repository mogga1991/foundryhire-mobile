'use client'

import { useState } from 'react'
import { BarChart3, TrendingUp, Clock, CheckCircle2, Users, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { useInterviewAnalytics, type AnalyticsPeriod } from '@/hooks/use-interview-analytics'
import { cn } from '@/lib/utils'

interface InterviewAnalyticsProps {
  className?: string
}

export function InterviewAnalytics({ className }: InterviewAnalyticsProps) {
  const [period, setPeriod] = useState<AnalyticsPeriod>('month')
  const { analytics, isLoading, error, refetch } = useInterviewAnalytics({ period })

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={refetch} className="mt-4">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (isLoading || !analytics) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="space-y-4" role="status" aria-label="Loading interview analytics">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
            <div className="h-64 bg-muted animate-pulse rounded-lg" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map(i => (
                <div key={i} className="h-64 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const { summary, timeSeries, competencyBreakdown, interviewerStats } = analytics

  // Prepare competency data for radar chart
  const competencyData = [
    {
      competency: 'Technical',
      score: competencyBreakdown.technical?.averageScore || 0,
    },
    {
      competency: 'Communication',
      score: competencyBreakdown.communication?.averageScore || 0,
    },
    {
      competency: 'Safety',
      score: competencyBreakdown.safety?.averageScore || 0,
    },
    {
      competency: 'Culture Fit',
      score: competencyBreakdown.cultureFit?.averageScore || 0,
    },
  ]

  const periods: Array<{ value: AnalyticsPeriod; label: string }> = [
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
    { value: 'quarter', label: 'Quarter' },
    { value: 'year', label: 'Year' },
  ]

  return (
    <div className={cn('space-y-6', className)}>
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Interview Analytics</h2>
          <p className="text-sm text-muted-foreground">
            Performance metrics and insights across your interview pipeline
          </p>
        </div>
        <div className="flex gap-2" role="group" aria-label="Time period selector">
          {periods.map(p => (
            <Button
              key={p.value}
              variant={period === p.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriod(p.value)}
              aria-pressed={period === p.value}
              aria-label={`View ${p.label.toLowerCase()} analytics`}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Interviews</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalInterviews}</div>
            <p className="text-xs text-muted-foreground">
              {summary.completedInterviews} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.completionRate}%</div>
            <p className="text-xs text-muted-foreground">
              {summary.completedInterviews} of {summary.totalInterviews}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.averageScore}/100</div>
            <div className="mt-1 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all"
                style={{ width: `${summary.averageScore}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.averageDuration} min</div>
            <p className="text-xs text-muted-foreground">Per interview</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bias Flags</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.biasFlags}</div>
            <p className="text-xs text-muted-foreground">
              {summary.totalInterviews > 0
                ? `${Math.round((summary.biasFlags / summary.totalInterviews) * 100)}% of total`
                : 'No interviews'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Time Series Chart */}
      {timeSeries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Interview Trends</CardTitle>
            <CardDescription>
              Interview volume and completion rate over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div role="img" aria-label={`Line chart showing interview trends over time. ${timeSeries.length} data points displaying total interviews and completions.`}>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={timeSeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(value) => new Date(value as string).toLocaleDateString()}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="interviews"
                  stroke="#3b82f6"
                  name="Total Interviews"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="completions"
                  stroke="#10b981"
                  name="Completed"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Competency Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Competency Scores</CardTitle>
            <CardDescription>
              Average performance across key competencies
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div role="img" aria-label="Radar chart showing average competency scores across technical, communication, safety, and culture fit dimensions">
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={competencyData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="competency" />
                <PolarRadiusAxis domain={[0, 100]} />
                <Radar
                  name="Average Score"
                  dataKey="score"
                  stroke="#8b5cf6"
                  fill="#8b5cf6"
                  fillOpacity={0.6}
                />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Interviewer Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Top Interviewers</CardTitle>
            <CardDescription>
              Interviewer performance and activity
            </CardDescription>
          </CardHeader>
          <CardContent>
            {interviewerStats.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No interviewer data available
              </p>
            ) : (
              <div className="space-y-3">
                {interviewerStats.slice(0, 5).map((interviewer) => (
                  <div
                    key={interviewer.interviewerId}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium">{interviewer.interviewerName}</p>
                      <p className="text-xs text-muted-foreground">
                        {interviewer.totalInterviews} interviews
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-semibold">
                          {interviewer.averageScore}/100
                        </p>
                        <p className="text-xs text-muted-foreground">Avg Score</p>
                      </div>
                      <Badge
                        variant={interviewer.completionRate >= 80 ? 'default' : 'secondary'}
                      >
                        {interviewer.completionRate}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Competency Details */}
      <Card>
        <CardHeader>
          <CardTitle>Competency Breakdown</CardTitle>
          <CardDescription>
            Detailed scores across all competency areas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div role="img" aria-label="Horizontal bar chart showing detailed competency breakdown scores from 0 to 100">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
              data={competencyData}
              layout="vertical"
              margin={{ left: 100 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" domain={[0, 100]} />
              <YAxis type="category" dataKey="competency" />
              <Tooltip />
              <Bar dataKey="score" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
