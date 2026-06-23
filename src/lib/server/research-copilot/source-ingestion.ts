import { createHash, randomUUID } from "node:crypto";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { getObjectStorage } from "@/lib/server/storage/object-storage";
import { buildResearchSourceObjectKey } from "@/lib/server/storage/object-keys";
import { researchCopilotRepository } from "@/lib/server/research-copilot/repository";
import type { ResearchSource, ResearchSourceChunk } from "@/lib/server/research-copilot/models";

const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
const MAX_TEXT_CHARS = 800_000;
const MAX_PDF_PAGES = 200;
const MAX_CHUNKS = 240;
const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"]);

function checksum(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

function assertSafeBytes(bytes: Uint8Array) {
  if (bytes.byteLength === 0) throw new Error("source_empty");
  if (bytes.byteLength > MAX_SOURCE_BYTES) throw new Error("source_too_large");
  const sample = Buffer.from(bytes.slice(0, Math.min(bytes.byteLength, 8192))).toString("utf8");
  if (/X5O!P%@AP\[4\\PZX54\(P\^\)7CC\)7\}\$EICAR-STANDARD-ANTIVIRUS-TEST-FILE/i.test(sample)) throw new Error("source_malware_signature_detected");
}

async function runExternalSafetyScan(bytes: Uint8Array, contentType: string, fileName: string) {
  const endpoint = process.env.SOURCE_MALWARE_SCAN_URL?.trim();
  if (!endpoint) return { provider: "local_signature_v1", clean: true };
  const url = new URL(endpoint);
  if (url.protocol !== "https:") throw new Error("malware_scan_provider_must_use_https");
  const form = new FormData();
  form.set("file", new Blob([Uint8Array.from(bytes).buffer], { type: contentType }), fileName);
  const response = await fetch(url, { method: "POST", headers: process.env.SOURCE_MALWARE_SCAN_TOKEN ? { Authorization: `Bearer ${process.env.SOURCE_MALWARE_SCAN_TOKEN}` } : {}, body: form, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`malware_scan_http_${response.status}`);
  const result = await response.json() as { clean?: boolean; threat?: string; provider?: string };
  if (result.clean !== true) throw new Error(`source_malware_detected${result.threat ? `_${result.threat}` : ""}`);
  return { provider: result.provider ?? url.hostname, clean: true };
}

async function runExternalOcr(bytes: Uint8Array) {
  const endpoint = process.env.DOCUMENT_OCR_PROVIDER_URL?.trim();
  if (!endpoint) return undefined;
  const url = new URL(endpoint);
  if (url.protocol !== "https:") throw new Error("ocr_provider_must_use_https");
  const form = new FormData();
  form.set("file", new Blob([Uint8Array.from(bytes).buffer], { type: "application/pdf" }), "source.pdf");
  const response = await fetch(url, { method: "POST", headers: process.env.DOCUMENT_OCR_PROVIDER_TOKEN ? { Authorization: `Bearer ${process.env.DOCUMENT_OCR_PROVIDER_TOKEN}` } : {}, body: form, signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`ocr_provider_http_${response.status}`);
  const result = await response.json() as { text?: string; confidence?: number; provider?: string };
  return result.text?.trim() ? { text: result.text.trim(), confidence: result.confidence, provider: result.provider ?? url.hostname } : undefined;
}

function fileKind(contentType: string, fileName: string, requested?: ResearchSource["source_type"]): ResearchSource["source_type"] {
  if (requested) return requested;
  if (contentType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf")) return "paper";
  if (contentType.startsWith("image/")) return "screenshot";
  if (/markdown/.test(contentType) || /\.md$/i.test(fileName)) return "markdown";
  return "text";
}

function parseTimestamp(line: string) {
  const match = line.match(/^\s*\[?(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:\.\d+)?\]?\s*/);
  if (!match) return undefined;
  return Number(match[1] ?? 0) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

function chunkText(input: { text: string; sourceId: string; programId: string; accountId: string; createdAt: string; transcript: boolean; pageCount?: number }) {
  const text = input.text.replace(/\u0000/g, "").trim().slice(0, MAX_TEXT_CHARS);
  if (!text) return [];
  const paragraphs = text.split(/\n\s*\n|(?<=\.)\s*\n/).map((part) => part.trim()).filter(Boolean);
  const groups: string[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    if (current && current.length + paragraph.length > 2800) {
      groups.push(current);
      current = "";
    }
    current += `${current ? "\n\n" : ""}${paragraph}`;
  }
  if (current) groups.push(current);
  let cursor = 0;
  return groups.slice(0, MAX_CHUNKS).map((content, index): ResearchSourceChunk => {
    const start = text.indexOf(content.slice(0, Math.min(80, content.length)), cursor);
    const safeStart = start >= 0 ? start : cursor;
    cursor = safeStart + content.length;
    const firstLine = content.split("\n", 1)[0] ?? "";
    const page = input.pageCount ? Math.min(input.pageCount, Math.max(1, Math.floor((safeStart / Math.max(1, text.length)) * input.pageCount) + 1)) : undefined;
    return {
      chunk_id: randomUUID(), source_id: input.sourceId, program_id: input.programId, account_id: input.accountId,
      chunk_index: index, content, anchor: {
        start_char: safeStart, end_char: safeStart + content.length,
        ...(input.transcript && parseTimestamp(firstLine) !== undefined ? { start_seconds: parseTimestamp(firstLine) } : {}),
        ...(page ? { page } : {}),
      },
      token_estimate: Math.ceil(content.length / 4), created_at: input.createdAt,
    };
  });
}

async function extractText(bytes: Uint8Array, type: ResearchSource["source_type"], contentType: string) {
  if (type === "screenshot") return { text: "", status: "needs_visual_context" as const, metadata: { visual_context_required: true } };
  if (type === "paper" || contentType === "application/pdf") {
    if (Buffer.from(bytes.slice(0, 5)).toString("ascii") !== "%PDF-") throw new Error("pdf_magic_bytes_invalid");
    const parsed = await pdfParse(Buffer.from(bytes));
    if (parsed.numpages > MAX_PDF_PAGES) throw new Error("pdf_page_limit_exceeded");
    let text = parsed.text.trim();
    const ocr = text.length <= 100 ? await runExternalOcr(bytes) : undefined;
    if (ocr?.text) text = ocr.text;
    return {
      text,
      status: text.length > 100 ? "ready" as const : "needs_ocr" as const,
      metadata: { page_count: parsed.numpages, extracted_chars: text.length, ocr_required: text.length <= 100, ocr_provider: ocr?.provider, ocr_confidence: ocr?.confidence },
    };
  }
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  return { text, status: "ready" as const, metadata: { extracted_chars: text.length } };
}

export async function ingestResearchSource(input: {
  programId: string;
  accountId: string;
  userId: string;
  title: string;
  fileName: string;
  contentType: string;
  bytes: Uint8Array;
  sourceType?: ResearchSource["source_type"];
  canonicalUrl?: string;
  metadata?: Record<string, unknown>;
}) {
  assertSafeBytes(input.bytes);
  const safetyScan = await runExternalSafetyScan(input.bytes, input.contentType, input.fileName);
  const sourceId = randomUUID();
  const createdAt = new Date().toISOString();
  const sourceType = fileKind(input.contentType, input.fileName, input.sourceType);
  const extraction = await extractText(input.bytes, sourceType, input.contentType);
  const storageKey = buildResearchSourceObjectKey({ accountId: input.accountId, programId: input.programId, sourceId, fileName: input.fileName });
  const stored = await getObjectStorage().putObject({ bucket: "research-sources", file_name: input.fileName, content_type: input.contentType, bytes: input.bytes, storage_key: storageKey });
  const source: ResearchSource = {
    source_id: sourceId, program_id: input.programId, account_id: input.accountId, created_by_user_id: input.userId,
    source_type: sourceType, title: input.title.trim().slice(0, 240) || input.fileName, canonical_url: input.canonicalUrl,
    file_name: input.fileName, content_type: input.contentType, storage_key: stored.storage_key,
    checksum_sha256: stored.checksum_sha256 || checksum(input.bytes), size_bytes: input.bytes.byteLength, status: extraction.status,
    metadata: { ...input.metadata, ...extraction.metadata, untrusted_content: true, safety_scan_provider: safetyScan.provider }, created_at: createdAt,
  };
  await researchCopilotRepository.saveSource(source);
  const chunks = chunkText({ text: extraction.text, sourceId, programId: input.programId, accountId: input.accountId, createdAt, transcript: sourceType === "transcript" || sourceType === "youtube_captions", pageCount: Number(extraction.metadata.page_count) || undefined });
  await researchCopilotRepository.saveChunks(chunks);
  return { source, chunks };
}

function parseYouTubeUrl(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== "https:" || !YOUTUBE_HOSTS.has(url.hostname.toLowerCase())) throw new Error("youtube_url_not_allowed");
  const id = url.hostname === "youtu.be" ? url.pathname.slice(1) : url.searchParams.get("v");
  if (!id || !/^[a-zA-Z0-9_-]{6,20}$/.test(id)) throw new Error("youtube_video_id_invalid");
  return { url: url.toString(), videoId: id };
}

export async function ingestYouTubeSource(input: { programId: string; accountId: string; userId: string; url: string; transcript?: string; title?: string }) {
  const parsed = parseYouTubeUrl(input.url);
  let transcript = input.transcript?.trim();
  let provider = "user_pasted";
  if (!transcript) {
    const endpoint = process.env.YOUTUBE_TRANSCRIPT_PROVIDER_URL?.trim();
    if (!endpoint) throw new Error("youtube_captions_unavailable_paste_transcript");
    const endpointUrl = new URL(endpoint);
    if (endpointUrl.protocol !== "https:") throw new Error("youtube_transcript_provider_must_use_https");
    const response = await fetch(endpointUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(process.env.YOUTUBE_TRANSCRIPT_PROVIDER_TOKEN ? { Authorization: `Bearer ${process.env.YOUTUBE_TRANSCRIPT_PROVIDER_TOKEN}` } : {}) },
      body: JSON.stringify({ video_id: parsed.videoId, url: parsed.url }), signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`youtube_transcript_provider_http_${response.status}`);
    const body = await response.json() as { transcript?: string; provider?: string; language?: string; automatic?: boolean };
    transcript = body.transcript?.trim();
    provider = body.provider ?? endpointUrl.hostname;
    if (!transcript) throw new Error("youtube_captions_empty");
  }
  return ingestResearchSource({
    programId: input.programId, accountId: input.accountId, userId: input.userId,
    title: input.title?.trim() || `YouTube transcript ${parsed.videoId}`, fileName: `${parsed.videoId}.txt`, contentType: "text/plain",
    bytes: new TextEncoder().encode(transcript), sourceType: "youtube_captions", canonicalUrl: parsed.url,
    metadata: { video_id: parsed.videoId, transcript_provider: provider, visual_context_processed: false, missing_visual_context_warning: true },
  });
}
