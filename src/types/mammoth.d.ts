declare module 'mammoth' {
  interface ConversionResult {
    value: string
    messages: Array<{
      type: string
      message: string
    }>
  }

  interface ConversionOptions {
    buffer?: Buffer
    path?: string
    arrayBuffer?: ArrayBuffer
    styleMap?: string[]
  }

  export function extractRawText(options: ConversionOptions): Promise<ConversionResult>
  export function convertToHtml(options: ConversionOptions): Promise<ConversionResult>
  export function convertToMarkdown(options: ConversionOptions): Promise<ConversionResult>
}
