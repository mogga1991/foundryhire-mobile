import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyAccess } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { interviews, candidates, jobs } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { generateJSON } from '@/lib/ai/claude'

interface AIAnalysis {
  summary: string
  sentimentScore: number
  competencyScores: {
    technical: number
    communication: number
    safety: number
    cultureFit: number
  }
  strengths: string[]
  concerns: string[]
  recommendation: string
  suggestedFollowUp: string[]
}

// POST /api/interviews/[id]/analyze - Run AI analysis on interview transcript
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { companyId } = await requireCompanyAccess()
    const { id: interviewId } = await params

    // Fetch interview with transcript
    const [interview] = await db
      .select({
        id: interviews.id,
        transcript: interviews.transcript,
        candidateId: interviews.candidateId,
        jobId: interviews.jobId,
        candidateFirstName: candidates.firstName,
        candidateLastName: candidates.lastName,
        jobTitle: jobs.title,
        jobRequirements: jobs.requirements,
        jobSkillsRequired: jobs.skillsRequired,
      })
      .from(interviews)
      .innerJoin(candidates, eq(interviews.candidateId, candidates.id))
      .leftJoin(jobs, eq(interviews.jobId, jobs.id))
      .where(and(eq(interviews.id, interviewId), eq(interviews.companyId, companyId)))
      .limit(1)

    if (!interview) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 })
    }

    if (!interview.transcript) {
      return NextResponse.json(
        { error: 'No transcript available for analysis' },
        { status: 400 }
      )
    }

    const prompt = `You are an AI interview analyst for a recruitment platform. Analyze the following interview transcript and provide a comprehensive assessment.

CONTEXT:
- Candidate: ${interview.candidateFirstName} ${interview.candidateLastName}
${interview.jobTitle ? `- Position: ${interview.jobTitle}` : ''}
${interview.jobRequirements ? `- Requirements: ${interview.jobRequirements.join(', ')}` : ''}
${interview.jobSkillsRequired ? `- Required Skills: ${interview.jobSkillsRequired.join(', ')}` : ''}

INTERVIEW TRANSCRIPT:
${interview.transcript}

Analyze the transcript and provide:
1. summary: A concise 2-3 sentence summary of the interview
2. sentimentScore: Overall sentiment/positivity score from 0-100
3. competencyScores: Score each area 0-100:
   - technical: Technical knowledge and problem-solving ability
   - communication: Clarity, articulation, and listening skills
   - safety: Safety awareness and compliance mindset (important for construction/field roles)
   - cultureFit: Values alignment and team compatibility
4. strengths: Array of 3-5 specific strengths demonstrated
5. concerns: Array of any concerns or red flags observed
6. recommendation: One of: "strong_hire", "hire", "maybe", "no_hire", "strong_no_hire"
7. suggestedFollowUp: Array of 2-3 suggested follow-up questions for next round

Return as JSON.`

    const analysis = await generateJSON<AIAnalysis>(prompt, 3000)

    // Update interview record with AI analysis
    await db
      .update(interviews)
      .set({
        aiSummary: analysis.summary,
        aiSentimentScore: analysis.sentimentScore,
        aiCompetencyScores: analysis.competencyScores,
        updatedAt: new Date(),
      })
      .where(eq(interviews.id, interviewId))

    return NextResponse.json({ analysis })
  } catch (error) {
    console.error('Error analyzing interview:', error)
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json(
      { error: 'Failed to analyze interview' },
      { status: 500 }
    )
  }
}
