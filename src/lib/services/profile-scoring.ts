import { createLogger } from '@/lib/logger'

const logger = createLogger('profile-scoring')

export interface ProfileScore {
  overallScore: number // 0-100
  breakdown: {
    basicInfo: { score: number; maxPoints: number; missing: string[] }
    experience: { score: number; maxPoints: number; missing: string[] }
    skills: { score: number; maxPoints: number; missing: string[] }
    resume: { score: number; maxPoints: number; missing: string[] }
    engagement: { score: number; maxPoints: number; missing: string[] }
  }
  completionPercentage: number
  nextSteps: string[] // Suggestions to improve score
  tier: 'complete' | 'strong' | 'moderate' | 'basic' | 'minimal'
}

export interface CandidateProfileInput {
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  phone?: string | null
  currentTitle?: string | null
  currentCompany?: string | null
  location?: string | null
  skills?: string[] | null
  headline?: string | null
  about?: string | null
  resumeUrl?: string | null
  resumeText?: string | null
  linkedinUrl?: string | null
  portfolioUrl?: string | null
  yearsOfExperience?: number | null
  interviewCount?: number
  feedbackCount?: number
}

/**
 * Calculate a profile completeness score for a candidate.
 * This is a deterministic, non-AI scoring function.
 *
 * Scoring breakdown:
 * - Basic Info (25 points): firstName (5), lastName (5), email (5), phone (3), location (4), headline (3)
 * - Experience (25 points): currentTitle (7), currentCompany (7), yearsOfExperience (6), linkedinUrl (5)
 * - Skills (20 points): skills array (10, min 3 items for full), portfolioUrl (5), about (5)
 * - Resume (15 points): resumeUrl (8), resumeText (7)
 * - Engagement (15 points): interviewCount > 0 (8), feedbackCount > 0 (7)
 */
export function calculateProfileScore(candidate: CandidateProfileInput): ProfileScore {
  // Basic Info (25 points)
  const basicInfo = scoreBasicInfo(candidate)

  // Experience (25 points)
  const experience = scoreExperience(candidate)

  // Skills (20 points)
  const skills = scoreSkills(candidate)

  // Resume (15 points)
  const resume = scoreResume(candidate)

  // Engagement (15 points)
  const engagement = scoreEngagement(candidate)

  const totalScore =
    basicInfo.score + experience.score + skills.score + resume.score + engagement.score
  const maxTotal =
    basicInfo.maxPoints +
    experience.maxPoints +
    skills.maxPoints +
    resume.maxPoints +
    engagement.maxPoints

  const overallScore = Math.round(totalScore)
  const completionPercentage = maxTotal > 0 ? Math.round((totalScore / maxTotal) * 100) : 0

  // Determine tier
  let tier: ProfileScore['tier']
  if (overallScore >= 90) tier = 'complete'
  else if (overallScore >= 70) tier = 'strong'
  else if (overallScore >= 50) tier = 'moderate'
  else if (overallScore >= 30) tier = 'basic'
  else tier = 'minimal'

  // Generate next steps (most impactful first)
  const nextSteps = generateNextSteps({
    basicInfo,
    experience,
    skills,
    resume,
    engagement,
  })

  logger.info({
    message: 'Profile score calculated',
    overallScore,
    tier,
    completionPercentage,
  })

  return {
    overallScore,
    breakdown: {
      basicInfo,
      experience,
      skills,
      resume,
      engagement,
    },
    completionPercentage,
    nextSteps,
    tier,
  }
}

function scoreBasicInfo(c: CandidateProfileInput): {
  score: number
  maxPoints: number
  missing: string[]
} {
  const maxPoints = 25
  let score = 0
  const missing: string[] = []

  if (c.firstName && c.firstName.trim()) score += 5
  else missing.push('First name')

  if (c.lastName && c.lastName.trim()) score += 5
  else missing.push('Last name')

  if (c.email && c.email.trim()) score += 5
  else missing.push('Email address')

  if (c.phone && c.phone.trim()) score += 3
  else missing.push('Phone number')

  if (c.location && c.location.trim()) score += 4
  else missing.push('Location')

  if (c.headline && c.headline.trim()) score += 3
  else missing.push('Professional headline')

  return { score, maxPoints, missing }
}

function scoreExperience(c: CandidateProfileInput): {
  score: number
  maxPoints: number
  missing: string[]
} {
  const maxPoints = 25
  let score = 0
  const missing: string[] = []

  if (c.currentTitle && c.currentTitle.trim()) score += 7
  else missing.push('Current job title')

  if (c.currentCompany && c.currentCompany.trim()) score += 7
  else missing.push('Current company')

  if (c.yearsOfExperience != null && c.yearsOfExperience >= 0) score += 6
  else missing.push('Years of experience')

  if (c.linkedinUrl && c.linkedinUrl.trim()) score += 5
  else missing.push('LinkedIn profile URL')

  return { score, maxPoints, missing }
}

function scoreSkills(c: CandidateProfileInput): {
  score: number
  maxPoints: number
  missing: string[]
} {
  const maxPoints = 20
  let score = 0
  const missing: string[] = []

  // Skills: 10 points, min 3 items for full score
  if (c.skills && c.skills.length > 0) {
    if (c.skills.length >= 3) {
      score += 10
    } else {
      // Partial credit: proportional to 3 skills
      score += Math.round((c.skills.length / 3) * 10)
      missing.push(`Add ${3 - c.skills.length} more skill(s) (currently ${c.skills.length})`)
    }
  } else {
    missing.push('Skills (at least 3 recommended)')
  }

  if (c.portfolioUrl && c.portfolioUrl.trim()) score += 5
  else missing.push('Portfolio URL')

  if (c.about && c.about.trim()) score += 5
  else missing.push('About / summary')

  return { score, maxPoints, missing }
}

function scoreResume(c: CandidateProfileInput): {
  score: number
  maxPoints: number
  missing: string[]
} {
  const maxPoints = 15
  let score = 0
  const missing: string[] = []

  if (c.resumeUrl && c.resumeUrl.trim()) score += 8
  else missing.push('Resume file upload')

  if (c.resumeText && c.resumeText.trim()) score += 7
  else missing.push('Resume text (parsed from uploaded resume)')

  return { score, maxPoints, missing }
}

function scoreEngagement(c: CandidateProfileInput): {
  score: number
  maxPoints: number
  missing: string[]
} {
  const maxPoints = 15
  let score = 0
  const missing: string[] = []

  if (c.interviewCount != null && c.interviewCount > 0) score += 8
  else missing.push('Complete at least one interview')

  if (c.feedbackCount != null && c.feedbackCount > 0) score += 7
  else missing.push('Receive interview feedback')

  return { score, maxPoints, missing }
}

/**
 * Generate ordered suggestions for improving the profile score.
 * Prioritizes the highest-impact missing items first.
 */
function generateNextSteps(breakdown: ProfileScore['breakdown']): string[] {
  const steps: Array<{ text: string; impact: number }> = []

  // Gather all missing items with their estimated impact
  for (const missing of breakdown.basicInfo.missing) {
    steps.push({ text: `Add your ${missing.toLowerCase()}`, impact: 5 })
  }
  for (const missing of breakdown.experience.missing) {
    steps.push({ text: `Add your ${missing.toLowerCase()}`, impact: 7 })
  }
  for (const missing of breakdown.skills.missing) {
    steps.push({
      text: missing.startsWith('Add ')
        ? missing
        : `Add your ${missing.toLowerCase()}`,
      impact: 6,
    })
  }
  for (const missing of breakdown.resume.missing) {
    steps.push({ text: `Upload your resume`, impact: 8 })
    break // Only suggest resume upload once
  }
  for (const missing of breakdown.engagement.missing) {
    steps.push({ text: missing, impact: 4 })
  }

  // Sort by impact (highest first) and return top 5
  steps.sort((a, b) => b.impact - a.impact)
  return steps.slice(0, 5).map((s) => s.text)
}
