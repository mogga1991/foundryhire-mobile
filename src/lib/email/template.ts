export interface TemplateContext {
  firstName: string
  lastName: string
  fullName: string
  email: string
  currentCompany: string
  currentTitle: string
  location: string
  jobTitle: string
  companyName: string
  senderName: string
  [key: string]: string
}

export function renderTemplate(template: string, context: Partial<TemplateContext>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return context[key as keyof TemplateContext] ?? match
  })
}
