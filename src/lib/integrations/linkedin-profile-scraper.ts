/**
 * LinkedIn Profile Scraper Service
 *
 * Uses Apify's `curious_coder/linkedin-profile-scraper` actor
 * to scrape full LinkedIn profiles including photos, experience,
 * education, skills, and certifications.
 *
 * Rate limit: max 500 profiles/day per LinkedIn account.
 */

import { ApifyClient } from 'apify-client'

const apifyClient = new ApifyClient({
  token: process.env.APIFY_API_TOKEN || '',
})

const LINKEDIN_SCRAPER_ACTOR_ID = '2SyF0bVxmgGr8IVCZ'  // dev_fusion/linkedin-profile-scraper (no cookies required)

// Daily rate limit tracking (resets per-process; for production use DB counter)
let dailyScrapeCount = 0
let lastResetDate = new Date().toDateString()
const DAILY_LIMIT = 500

// =============================================================================
// Types
// =============================================================================

export interface LinkedInExperience {
  title: string
  company: string
  location: string | null
  startDate: string | null
  endDate: string | null
  duration: string | null
  description: string | null
  isCurrent: boolean
}

export interface LinkedInEducation {
  school: string
  degree: string | null
  fieldOfStudy: string | null
  startDate: string | null
  endDate: string | null
}

export interface LinkedInCertification {
  name: string
  issuingOrganization: string | null
  issueDate: string | null
}

export interface LinkedInProfileData {
  profileImageUrl: string | null
  headline: string | null
  about: string | null
  experience: LinkedInExperience[]
  education: LinkedInEducation[]
  skills: string[]
  certifications: LinkedInCertification[]
}

// =============================================================================
// Rate Limiting
// =============================================================================

function checkDailyLimit(): boolean {
  const today = new Date().toDateString()
  if (today !== lastResetDate) {
    dailyScrapeCount = 0
    lastResetDate = today
  }
  return dailyScrapeCount < DAILY_LIMIT
}

function incrementDailyCount(): void {
  dailyScrapeCount++
}

// =============================================================================
// Profile Scraping
// =============================================================================

/**
 * Scrape a full LinkedIn profile using Apify.
 * Returns structured profile data or null on failure.
 */
export async function scrapeLinkedInProfile(
  linkedinUrl: string
): Promise<LinkedInProfileData | null> {
  if (!linkedinUrl) return null

  // Clean the URL
  const cleanUrl = linkedinUrl.trim().replace(/\/$/, '')
  if (!cleanUrl.includes('linkedin.com/in/')) {
    console.warn(`[LinkedIn Scraper] Invalid LinkedIn URL: ${cleanUrl}`)
    return null
  }

  // Check rate limit
  if (!checkDailyLimit()) {
    console.warn('[LinkedIn Scraper] Daily rate limit reached (500/day)')
    return null
  }

  try {
    console.log(`[LinkedIn Scraper] Scraping profile: ${cleanUrl}`)

    const run = await apifyClient.actor(LINKEDIN_SCRAPER_ACTOR_ID).call(
      {
        profileUrls: [cleanUrl],
      },
      {
        timeout: 120, // 2 minute timeout
        memory: 512,
      }
    )

    const { items } = await apifyClient
      .dataset(run.defaultDatasetId)
      .listItems()

    if (!items || items.length === 0) {
      console.warn('[LinkedIn Scraper] No results returned')
      return null
    }

    incrementDailyCount()

    const profile = items[0] as Record<string, any>
    return mapProfileData(profile)
  } catch (error) {
    console.error('[LinkedIn Scraper] Error scraping profile:', error)
    return null
  }
}

// =============================================================================
// Data Mapping
// =============================================================================

function mapProfileData(raw: Record<string, any>): LinkedInProfileData & { totalExperienceYears: number | null } {
  return {
    profileImageUrl: raw.profilePicHighQuality || raw.profilePic || raw.pictureUrl || raw.profilePicture || raw.profileImageUrl || null,
    headline: raw.headline || raw.title || null,
    about: raw.summary || raw.about || null,
    experience: mapExperience(raw),
    education: mapEducation(raw),
    skills: mapSkills(raw),
    certifications: mapCertifications(raw),
    totalExperienceYears: raw.totalExperienceYears || raw.currentJobDurationInYrs || null,
  }
}

function mapExperience(raw: Record<string, any>): LinkedInExperience[] {
  const positions = raw.experiences || raw.positions || raw.experience || raw.workExperience || []
  if (!Array.isArray(positions)) return []

  return positions.map((pos: any) => ({
    title: pos.title || pos.position || pos.jobTitle || '',
    company: pos.subtitle || pos.companyName || pos.company || pos.organizationName || '',
    location: pos.location || pos.locationName || pos.caption || null,
    startDate: pos.startEndDate || pos.startDate || pos.start || null,
    endDate: pos.endDate || pos.end || null,
    duration: pos.duration || null,
    description: pos.description || pos.summary || null,
    isCurrent: Boolean(pos.isCurrent || pos.isCurrentPosition || (pos.startEndDate && pos.startEndDate.includes('Present'))),
  }))
}

function mapEducation(raw: Record<string, any>): LinkedInEducation[] {
  const educations = raw.educations || raw.education || []
  if (!Array.isArray(educations)) return []

  return educations.map((edu: any) => ({
    school: edu.schoolName || edu.school || edu.institutionName || '',
    degree: edu.degree || edu.degreeName || null,
    fieldOfStudy: edu.fieldOfStudy || edu.field || null,
    startDate: edu.startDate || edu.start || null,
    endDate: edu.endDate || edu.end || null,
  }))
}

function mapSkills(raw: Record<string, any>): string[] {
  const skills = raw.skills || []
  if (!Array.isArray(skills)) return []

  return skills
    .map((s: any) => (typeof s === 'string' ? s : s.title || s.name || s.skill || ''))
    .filter((s: string) => s.length > 0 && s.length < 100)
    .slice(0, 30)
}

function mapCertifications(raw: Record<string, any>): LinkedInCertification[] {
  const certs = raw.licenseAndCertificates || raw.certifications || raw.certificates || []
  if (!Array.isArray(certs)) return []

  return certs.map((cert: any) => ({
    name: cert.title || cert.name || '',
    issuingOrganization: cert.subtitle || cert.authority || cert.issuingOrganization || cert.company || null,
    issueDate: cert.caption || cert.issueDate || cert.startDate || null,
  }))
}
