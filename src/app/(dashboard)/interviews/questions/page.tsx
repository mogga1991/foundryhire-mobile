import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { companyUsers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { QuestionBank } from '@/components/interviews/question-bank'
import { InterviewTemplateBuilder } from '@/components/interviews/interview-template-builder'

export const metadata = {
  title: 'Question Bank | VerticalHire',
  description: 'Manage interview questions and templates',
}

export default async function QuestionBankPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const [companyUser] = await db
    .select({ companyId: companyUsers.companyId })
    .from(companyUsers)
    .where(eq(companyUsers.userId, session.user.id))
    .limit(1)

  if (!companyUser) redirect('/settings/company')

  // In production, fetch questions from the database
  // For now, pass empty array
  const questions: any[] = []

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Link href="/interviews">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Interviews
          </Button>
        </Link>

        <div>
          <h1 className="text-3xl font-bold tracking-tight">Interview Question Management</h1>
          <p className="text-muted-foreground mt-2">
            Build and manage your interview question bank and templates
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="questions" className="space-y-6">
        <TabsList>
          <TabsTrigger value="questions">Question Bank</TabsTrigger>
          <TabsTrigger value="templates">Interview Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="questions" className="space-y-6">
          <QuestionBank />
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          <InterviewTemplateBuilder availableQuestions={questions} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
