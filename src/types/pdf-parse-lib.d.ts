declare module "pdf-parse/lib/pdf-parse.js" {
  export type PdfParseResult = {
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: unknown;
    text: string;
    version: string;
  };

  export default function pdfParse(data: Buffer | Uint8Array, options?: Record<string, unknown>): Promise<PdfParseResult>;
}
