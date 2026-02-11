/**
 * Interview Export Service
 *
 * Generates PDF/HTML reports and CSV exports for interview data.
 * Used for compliance audits, hiring committee review, and candidate records.
 */

import { db } from '@/lib/db'
import { interviews, candidates, jobs, interviewFeedback, users } from '@/lib/db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { createLogger } from '@/lib/logger'

const logger = createLogger('interview-export')

interface InterviewReportData {
  interview: {
    id: string
    scheduledAt: Date
    durationMinutes: number | null
    status: string
    interviewType: string
    aiSummary: string | null
    aiSentimentScore: number | null
    aiCompetencyScores: any
    transcript: string | null
    createdAt: Date
  }
  candidate: {
    firstName: string
    lastName: string
    email: string | null
  }
  job: {
    title: string | null
  }
  feedback: Array<{
    id: string
    rating: number
    feedbackText: string | null
    recommendation: string | null
    userName: string | null
    createdAt: Date
  }>
  keyMoments?: Array<{
    timestamp?: string
    quote: string
    significance: string
    sentiment: string
  }>
}

/**
 * Fetch interview data with all related information
 */
async function fetchInterviewData(interviewId: string): Promise<InterviewReportData | null> {
  // Fetch interview with candidate and job
  const [interview] = await db
    .select({
      // Interview fields
      id: interviews.id,
      scheduledAt: interviews.scheduledAt,
      durationMinutes: interviews.durationMinutes,
      status: interviews.status,
      interviewType: interviews.interviewType,
      aiSummary: interviews.aiSummary,
      aiSentimentScore: interviews.aiSentimentScore,
      aiCompetencyScores: interviews.aiCompetencyScores,
      transcript: interviews.transcript,
      createdAt: interviews.createdAt,
      // Candidate fields
      candidateFirstName: candidates.firstName,
      candidateLastName: candidates.lastName,
      candidateEmail: candidates.email,
      // Job fields
      jobTitle: jobs.title,
    })
    .from(interviews)
    .innerJoin(candidates, eq(interviews.candidateId, candidates.id))
    .leftJoin(jobs, eq(interviews.jobId, jobs.id))
    .where(eq(interviews.id, interviewId))
    .limit(1)

  if (!interview) {
    return null
  }

  // Fetch feedback
  const feedbackRecords = await db
    .select({
      id: interviewFeedback.id,
      rating: interviewFeedback.rating,
      feedbackText: interviewFeedback.feedbackText,
      recommendation: interviewFeedback.recommendation,
      createdAt: interviewFeedback.createdAt,
      userName: users.name,
    })
    .from(interviewFeedback)
    .leftJoin(users, eq(interviewFeedback.userId, users.id))
    .where(eq(interviewFeedback.interviewId, interviewId))

  return {
    interview: {
      id: interview.id,
      scheduledAt: interview.scheduledAt,
      durationMinutes: interview.durationMinutes,
      status: interview.status,
      interviewType: interview.interviewType,
      aiSummary: interview.aiSummary,
      aiSentimentScore: interview.aiSentimentScore,
      aiCompetencyScores: interview.aiCompetencyScores,
      transcript: interview.transcript,
      createdAt: interview.createdAt,
    },
    candidate: {
      firstName: interview.candidateFirstName,
      lastName: interview.candidateLastName,
      email: interview.candidateEmail,
    },
    job: {
      title: interview.jobTitle,
    },
    feedback: feedbackRecords,
  }
}

/**
 * Generate HTML report for a single interview
 * Can be printed to PDF by browser or used as shareable report
 */
export async function generateInterviewHtmlReport(interviewId: string): Promise<string> {
  logger.info({ message: 'Generating HTML report', interviewId })

  const data = await fetchInterviewData(interviewId)

  if (!data) {
    throw new Error('Interview not found')
  }

  const candidateName = `${data.candidate.firstName} ${data.candidate.lastName}`
  const jobTitle = data.job.title || 'Position not specified'
  const competencyScores = data.interview.aiCompetencyScores as any || {}

  // Format competency scores
  const competencies = [
    { name: 'Technical', score: competencyScores.technical || 'N/A' },
    { name: 'Communication', score: competencyScores.communication || 'N/A' },
    { name: 'Problem Solving', score: competencyScores.problemSolving || 'N/A' },
    { name: 'Leadership', score: competencyScores.leadership || 'N/A' },
    { name: 'Domain Expertise', score: competencyScores.domainExpertise || competencyScores.safety || 'N/A' },
    { name: 'Culture Fit', score: competencyScores.cultureFit || 'N/A' },
    { name: 'Adaptability', score: competencyScores.adaptability || 'N/A' },
  ]

  // Truncate transcript if too long
  const maxTranscriptLength = 3000
  let transcriptDisplay = data.interview.transcript || 'No transcript available'
  let transcriptTruncated = false

  if (transcriptDisplay.length > maxTranscriptLength) {
    transcriptDisplay = transcriptDisplay.substring(0, maxTranscriptLength)
    transcriptTruncated = true
  }

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Interview Report - ${candidateName}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
      padding: 20px;
    }

    .container {
      max-width: 900px;
      margin: 0 auto;
      background: white;
      padding: 40px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }

    .header {
      border-bottom: 3px solid #2563eb;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }

    .header h1 {
      font-size: 28px;
      color: #1e40af;
      margin-bottom: 10px;
    }

    .header .meta {
      color: #666;
      font-size: 14px;
    }

    .section {
      margin-bottom: 30px;
    }

    .section h2 {
      font-size: 20px;
      color: #1e40af;
      margin-bottom: 15px;
      border-left: 4px solid #2563eb;
      padding-left: 12px;
    }

    .info-grid {
      display: grid;
      grid-template-columns: 150px 1fr;
      gap: 10px;
      margin-bottom: 15px;
    }

    .info-label {
      font-weight: 600;
      color: #666;
    }

    .info-value {
      color: #333;
    }

    .competency-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }

    .competency-table th,
    .competency-table td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #e5e5e5;
    }

    .competency-table th {
      background-color: #f9fafb;
      font-weight: 600;
      color: #374151;
    }

    .score {
      font-weight: 600;
      color: #2563eb;
    }

    .score.high {
      color: #16a34a;
    }

    .score.medium {
      color: #ea580c;
    }

    .score.low {
      color: #dc2626;
    }

    .feedback-card {
      background: #f9fafb;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 15px;
      border-left: 3px solid #2563eb;
    }

    .feedback-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
    }

    .feedback-author {
      font-weight: 600;
      color: #1e40af;
    }

    .feedback-rating {
      background: #2563eb;
      color: white;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 14px;
    }

    .feedback-text {
      color: #4b5563;
      margin-bottom: 8px;
    }

    .feedback-recommendation {
      font-style: italic;
      color: #6b7280;
      font-size: 14px;
    }

    .transcript {
      background: #f9fafb;
      padding: 20px;
      border-radius: 8px;
      font-family: 'Courier New', monospace;
      font-size: 13px;
      line-height: 1.8;
      color: #374151;
      white-space: pre-wrap;
      max-height: 500px;
      overflow-y: auto;
    }

    .truncated-notice {
      background: #fef3c7;
      border: 1px solid #fbbf24;
      padding: 10px;
      border-radius: 4px;
      margin-top: 10px;
      font-size: 14px;
      color: #92400e;
    }

    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #e5e5e5;
      text-align: center;
      color: #9ca3af;
      font-size: 14px;
    }

    @media print {
      body {
        background: white;
        padding: 0;
      }

      .container {
        box-shadow: none;
        padding: 20px;
      }

      .transcript {
        max-height: none;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Interview Report</h1>
      <div class="meta">Generated on ${new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })}</div>
    </div>

    <div class="section">
      <h2>Candidate Information</h2>
      <div class="info-grid">
        <div class="info-label">Name:</div>
        <div class="info-value">${candidateName}</div>
        <div class="info-label">Email:</div>
        <div class="info-value">${data.candidate.email || 'N/A'}</div>
        <div class="info-label">Position:</div>
        <div class="info-value">${jobTitle}</div>
      </div>
    </div>

    <div class="section">
      <h2>Interview Details</h2>
      <div class="info-grid">
        <div class="info-label">Date & Time:</div>
        <div class="info-value">${data.interview.scheduledAt.toLocaleString('en-US', {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })}</div>
        <div class="info-label">Duration:</div>
        <div class="info-value">${data.interview.durationMinutes || 'N/A'} minutes</div>
        <div class="info-label">Type:</div>
        <div class="info-value">${data.interview.interviewType}</div>
        <div class="info-label">Status:</div>
        <div class="info-value">${data.interview.status}</div>
      </div>
    </div>

    ${data.interview.aiSummary ? `
    <div class="section">
      <h2>AI Analysis Summary</h2>
      <p>${data.interview.aiSummary}</p>
      ${data.interview.aiSentimentScore !== null ? `
        <div class="info-grid" style="margin-top: 15px;">
          <div class="info-label">Overall Sentiment:</div>
          <div class="info-value">${data.interview.aiSentimentScore}/100</div>
        </div>
      ` : ''}
    </div>
    ` : ''}

    <div class="section">
      <h2>Competency Scores</h2>
      <table class="competency-table">
        <thead>
          <tr>
            <th>Competency</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          ${competencies.map(comp => {
            const score = typeof comp.score === 'number' ? comp.score : null
            let scoreClass = ''
            if (score !== null) {
              if (score >= 70) scoreClass = 'high'
              else if (score >= 50) scoreClass = 'medium'
              else scoreClass = 'low'
            }
            return `
              <tr>
                <td>${comp.name}</td>
                <td><span class="score ${scoreClass}">${score !== null ? score + '/100' : 'N/A'}</span></td>
              </tr>
            `
          }).join('')}
        </tbody>
      </table>
    </div>

    ${data.feedback.length > 0 ? `
    <div class="section">
      <h2>Interviewer Feedback</h2>
      ${data.feedback.map(fb => `
        <div class="feedback-card">
          <div class="feedback-header">
            <div class="feedback-author">${fb.userName || 'Anonymous'}</div>
            <div class="feedback-rating">Rating: ${fb.rating}/10</div>
          </div>
          ${fb.feedbackText ? `<div class="feedback-text">${fb.feedbackText}</div>` : ''}
          ${fb.recommendation ? `<div class="feedback-recommendation">Recommendation: ${fb.recommendation}</div>` : ''}
        </div>
      `).join('')}
    </div>
    ` : ''}

    ${data.interview.transcript ? `
    <div class="section">
      <h2>Interview Transcript</h2>
      <div class="transcript">${transcriptDisplay.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
      ${transcriptTruncated ? `
        <div class="truncated-notice">
          <strong>Note:</strong> Transcript has been truncated for readability.
          See full transcript in the application.
        </div>
      ` : ''}
    </div>
    ` : ''}

    <div class="footer">
      <p>Generated by VerticalHire AI Interview Platform</p>
      <p>Report ID: ${interviewId}</p>
    </div>
  </div>
</body>
</html>
  `

  logger.info({ message: 'HTML report generated', interviewId })

  return html
}

/**
 * Generate CSV export for multiple interviews
 */
export async function generateInterviewsCsv(
  interviewIds: string[],
  companyId: string
): Promise<string> {
  logger.info({ message: 'Generating CSV export', count: interviewIds.length, companyId })

  if (interviewIds.length === 0) {
    throw new Error('No interview IDs provided')
  }

  // Fetch interviews
  const interviewsData = await db
    .select({
      id: interviews.id,
      candidateFirstName: candidates.firstName,
      candidateLastName: candidates.lastName,
      candidateEmail: candidates.email,
      jobTitle: jobs.title,
      scheduledAt: interviews.scheduledAt,
      durationMinutes: interviews.durationMinutes,
      status: interviews.status,
      aiSummary: interviews.aiSummary,
      aiSentimentScore: interviews.aiSentimentScore,
      aiCompetencyScores: interviews.aiCompetencyScores,
      createdAt: interviews.createdAt,
    })
    .from(interviews)
    .innerJoin(candidates, eq(interviews.candidateId, candidates.id))
    .leftJoin(jobs, eq(interviews.jobId, jobs.id))
    .where(and(
      eq(interviews.companyId, companyId),
      inArray(interviews.id, interviewIds)
    ))

  // Count feedback for each interview
  const feedbackCounts = await db
    .select({
      interviewId: interviewFeedback.interviewId,
      count: db.$count(interviewFeedback.id),
    })
    .from(interviewFeedback)
    .where(inArray(interviewFeedback.interviewId, interviewIds))
    .groupBy(interviewFeedback.interviewId)

  const feedbackCountMap = new Map(
    feedbackCounts.map(fc => [fc.interviewId, fc.count])
  )

  // Build CSV
  const headers = [
    'Interview ID',
    'Candidate Name',
    'Candidate Email',
    'Job Title',
    'Scheduled At',
    'Duration (min)',
    'Status',
    'AI Score',
    'Sentiment',
    'Recommendation',
    'Feedback Count',
    'Created At',
  ]

  const rows = interviewsData.map(interview => {
    const competencyScores = interview.aiCompetencyScores as any || {}

    // Calculate average score from all competencies
    const scores = [
      competencyScores.technical,
      competencyScores.communication,
      competencyScores.problemSolving,
      competencyScores.leadership,
      competencyScores.domainExpertise || competencyScores.safety,
      competencyScores.cultureFit,
      competencyScores.adaptability,
    ].filter(s => typeof s === 'number')

    const avgScore = scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null

    // Extract recommendation from summary if available
    let recommendation = 'N/A'
    if (interview.aiSummary) {
      const summaryLower = interview.aiSummary.toLowerCase()
      if (summaryLower.includes('strong hire') || summaryLower.includes('strongly recommend')) {
        recommendation = 'Strong Hire'
      } else if (summaryLower.includes('hire') || summaryLower.includes('recommend')) {
        recommendation = 'Hire'
      } else if (summaryLower.includes('maybe') || summaryLower.includes('uncertain')) {
        recommendation = 'Maybe'
      } else if (summaryLower.includes('no hire') || summaryLower.includes('not recommend')) {
        recommendation = 'No Hire'
      }
    }

    return [
      interview.id,
      `${interview.candidateFirstName} ${interview.candidateLastName}`,
      interview.candidateEmail || 'N/A',
      interview.jobTitle || 'N/A',
      interview.scheduledAt.toISOString(),
      interview.durationMinutes?.toString() || 'N/A',
      interview.status,
      avgScore !== null ? avgScore.toString() : 'N/A',
      interview.aiSentimentScore?.toString() || 'N/A',
      recommendation,
      (feedbackCountMap.get(interview.id) || 0).toString(),
      interview.createdAt.toISOString(),
    ]
  })

  // Escape CSV values properly
  const escapeCsvValue = (value: string): string => {
    // If value contains comma, quote, or newline, wrap in quotes and escape quotes
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`
    }
    return value
  }

  const csvLines = [
    headers.map(escapeCsvValue).join(','),
    ...rows.map(row => row.map(escapeCsvValue).join(',')),
  ]

  const csv = csvLines.join('\n')

  logger.info({ message: 'CSV export generated', rowCount: rows.length })

  return csv
}
