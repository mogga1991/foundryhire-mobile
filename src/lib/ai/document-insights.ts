export interface DocumentInsightResult {
  score: number
  insights: string[]
}

export function generateDocumentInsights(input: {
  documentType: string
  fileName: string
  fileSizeBytes?: number | null
}): DocumentInsightResult {
  const insights: string[] = []
  let score = 65

  const normalizedType = input.documentType.toLowerCase()
  const normalizedName = input.fileName.toLowerCase()
  const size = input.fileSizeBytes ?? 0

  if (normalizedType === 'resume') {
    score += 10
    insights.push('Resume uploaded and available for role matching.')
  }

  if (normalizedType === 'license' || normalizedType === 'certification') {
    score += 8
    insights.push('Credential document supports compliance and eligibility checks.')
  }

  if (normalizedName.includes('signed') || normalizedName.includes('verified')) {
    score += 5
    insights.push('Filename indicates a validated or signed document.')
  }

  if (size > 0 && size < 50_000) {
    score -= 8
    insights.push('Document appears very small; verify content completeness.')
  } else if (size > 5_000_000) {
    score -= 6
    insights.push('Large file size may slow reviewer processing.')
  } else {
    score += 4
  }

  if (insights.length === 0) {
    insights.push('Document uploaded successfully and queued for recruiter review.')
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    insights,
  }
}
