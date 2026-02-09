declare module 'pdf-parse' {
  export interface PDFPage {
    text: string
    pageNumber: number
  }

  export interface PDFMetadata {
    title?: string
    author?: string
    subject?: string
    keywords?: string
    creator?: string
    producer?: string
    creationDate?: Date
    modificationDate?: Date
  }

  export interface PDFParseResult {
    pages: PDFPage[]
    metadata?: PDFMetadata
    numPages: number
  }

  export class PDFParse {
    constructor(data: Buffer | ArrayBuffer | Uint8Array)
    parse(): Promise<PDFParseResult>
  }

  export enum VerbosityLevel {
    ERRORS = 0,
    WARNINGS = 1,
    INFOS = 5,
  }
}
