"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUp,
  Check,
  FileText,
  Link2,
  LoaderCircle,
  Paperclip,
  RotateCcw,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  CopilotConversationDetail,
  ResearchMessage,
  ResearchProposal,
} from "@/lib/server/research-copilot/models";
import type { CatalogEntry } from "@/lib/server/research-c2/models";

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function CandidateProposal({
  proposal,
  programId,
  onDecision,
}: {
  proposal: ResearchProposal;
  programId: string;
  onDecision: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const payload = proposal.payload as Record<string, unknown>;
  async function decide(decision: "confirmed" | "rejected") {
    setBusy(true);
    try {
      const response = await fetch(
        `/api/programs/${programId}/conversation/proposals/${proposal.proposal_id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision }),
        },
      );
      if (!response.ok)
        throw new Error(
          (await response.json()).error?.message ?? "decision_failed",
        );
      onDecision();
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-3 border-l-2 border-brand bg-surface-subtle px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-provenance text-[10px] uppercase text-brand">
            {proposal.proposal_type.replace(/_/g, " ")} · v{proposal.version}
          </p>
          <h4 className="mt-2 text-sm font-semibold leading-6 text-text-institutional">
            {String(payload.claim ?? proposal.title)}
          </h4>
        </div>
        <span className="rounded-sm border border-border-subtle bg-surface-white px-2 py-1 text-[10px] uppercase text-text-neutral">
          {proposal.status}
        </span>
      </div>
      <dl className="mt-3 grid gap-3 text-xs leading-5 sm:grid-cols-2">
        {[
          "mechanism",
          "observable_proxy",
          "entry_idea",
          "exit_idea",
          "falsification_test",
          "rationale",
        ].map((key) =>
          payload[key] ? (
            <div key={key} className="min-w-0">
              <dt className="font-provenance uppercase text-text-muted">
                {key.replace(/_/g, " ")}
              </dt>
              <dd className="mt-1 break-words text-text-neutral">
                {String(payload[key])}
              </dd>
            </div>
          ) : null,
        )}
      </dl>
      {proposal.status === "proposed" ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" disabled={busy} onClick={() => decide("confirmed")}>
            <Check className="h-4 w-4" /> Confirm candidate
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => decide("rejected")}
          >
            <X className="h-4 w-4" /> Reject
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function ResearchCopilot({
  programId,
  initialDetail,
  artifacts = [],
  initialSourceOpen = false,
}: {
  programId: string;
  initialDetail: CopilotConversationDetail;
  artifacts?: CatalogEntry[];
  initialSourceOpen?: boolean;
}) {
  const [detail, setDetail] = useState(initialDetail);
  const [content, setContent] = useState("");
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [selectedArtifacts, setSelectedArtifacts] = useState<string[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceOpen, setSourceOpen] = useState(initialSourceOpen);
  const [sourceBusy, setSourceBusy] = useState(false);
  const [sourceText, setSourceText] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const router = useRouter();
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const requestControllerRef = useRef<AbortController | null>(null);

  const proposalsByMessage = useMemo(() => {
    const map = new Map<string, ResearchProposal[]>();
    for (const proposal of detail.proposals)
      map.set(proposal.source_message_id, [
        ...(map.get(proposal.source_message_id) ?? []),
        proposal,
      ]);
    return map;
  }, [detail.proposals]);

  async function reload() {
    const response = await fetch(`/api/programs/${programId}/conversation`, {
      cache: "no-store",
    });
    const payload = await response.json();
    if (response.ok) setDetail(payload.detail);
    router.refresh();
  }

  async function send() {
    const text = content.trim();
    if (text.length < 2 || busy) return;
    setBusy(true);
    setError(null);
    setStreamingText("");
    setContent("");
    const requestController = new AbortController();
    requestControllerRef.current = requestController;
    try {
      const response = await fetch(`/api/programs/${programId}/conversation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: text,
          source_ids: selectedSources,
          artifact_ids: selectedArtifacts,
        }),
        signal: requestController.signal,
      });
      if (!response.ok || !response.body)
        throw new Error("copilot_request_failed");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const eventBlock of events) {
          const event = eventBlock.match(/^event: (.+)$/m)?.[1];
          const raw = eventBlock.match(/^data: (.+)$/m)?.[1];
          if (!raw) continue;
          const data = JSON.parse(raw);
          if (event === "delta")
            setStreamingText((current) => current + String(data.text ?? ""));
          if (event === "error")
            throw new Error(data.message ?? "copilot_turn_failed");
        }
      }
      await reload();
      setSelectedSources([]);
      setSelectedArtifacts([]);
      setStreamingText("");
    } catch (caught) {
      setContent(text);
      setError(
        requestController.signal.aborted
          ? "Turn stopped. Your message is preserved for revision or retry."
          : caught instanceof Error
            ? caught.message
            : "copilot_turn_failed",
      );
    } finally {
      requestControllerRef.current = null;
      setBusy(false);
      composerRef.current?.focus();
    }
  }

  async function uploadSource() {
    if (!file && !sourceText.trim() && !youtubeUrl.trim()) return;
    setSourceBusy(true);
    setError(null);
    try {
      let response: Response;
      if (youtubeUrl.trim()) {
        response = await fetch(
          `/api/programs/${programId}/conversation/sources`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url: youtubeUrl,
              transcript: sourceText,
              title: sourceTitle,
            }),
          },
        );
      } else {
        const form = new FormData();
        if (file) form.set("file", file);
        if (sourceText.trim()) form.set("text", sourceText);
        form.set("title", sourceTitle || file?.name || "Research source");
        form.set("source_type", sourceText.trim() && !file ? "transcript" : "");
        response = await fetch(
          `/api/programs/${programId}/conversation/sources`,
          { method: "POST", body: form },
        );
      }
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error?.message ?? "source_upload_failed");
      setFile(null);
      setSourceText("");
      setSourceTitle("");
      setYoutubeUrl("");
      setSelectedSources([payload.source.source_id]);
      if (!content.trim()) {
        setContent(
          "Extract the testable trading hypotheses from the selected source. Separate direct claims from inferred assumptions, cite the source chunks, and propose only hypotheses that can become a falsifiable crypto strategy test.",
        );
      }
      await reload();
      setSourceOpen(false);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "source_upload_failed",
      );
    } finally {
      setSourceBusy(false);
    }
  }
  function draftSourceExtractionPrompt() {
    setContent(
      "Extract the testable trading hypotheses from the selected source. Separate direct claims from inferred assumptions, cite the source chunks, identify missing data, and propose candidate Hypothesis Cards only where the evidence supports them.",
    );
    composerRef.current?.focus();
  }
  async function proposeArtifactAction(
    messageId: string,
    proposalType: "research_note" | "next_experiment",
  ) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/programs/${programId}/conversation/artifact-actions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message_id: messageId,
            proposal_type: proposalType,
          }),
        },
      );
      if (!response.ok)
        throw new Error(
          (await response.json()).error?.message ?? "artifact_action_failed",
        );
      await reload();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "artifact_action_failed",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-[680px] overflow-hidden rounded-md border border-border-subtle bg-surface-white lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="flex min-h-0 flex-col">
        <div className="border-b border-border-subtle px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-text-institutional">
                Research conversation
              </p>
              <p className="mt-1 text-xs text-text-neutral">
                Upload papers, transcripts, notes, or screenshots here. Suggestions stay provisional until you confirm a research object.
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setSourceOpen((value) => !value)}
            >
              <Paperclip className="h-4 w-4" /> Add source
            </Button>
          </div>
          {sourceOpen ? (
            <div className="mt-4 grid gap-3 border-t border-border-subtle pt-4 md:grid-cols-2">
              <div className="rounded-sm border border-border-subtle bg-surface-subtle px-3 py-2 text-xs leading-5 text-text-neutral md:col-span-2">
                Add a PDF paper, pasted transcript, Markdown/text note, screenshot, or YouTube caption source. The assistant treats source content as untrusted evidence and can extract candidate hypotheses with citations after upload.
              </div>
              <input
                value={sourceTitle}
                onChange={(event) => setSourceTitle(event.target.value)}
                placeholder="Source title"
                className="rounded-sm border border-border-subtle px-3 py-2 text-sm"
              />
              <input
                value={youtubeUrl}
                onChange={(event) => setYoutubeUrl(event.target.value)}
                placeholder="YouTube URL (optional)"
                className="rounded-sm border border-border-subtle px-3 py-2 text-sm"
              />
              <input
                type="file"
                accept=".pdf,.txt,.md,image/*"
                aria-label="Upload paper, transcript, note, or screenshot"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                className="text-xs text-text-neutral"
              />
              <textarea
                value={sourceText}
                onChange={(event) => setSourceText(event.target.value)}
                placeholder="Paste transcript or source text. For YouTube, paste captions here when automatic retrieval is unavailable."
                rows={4}
                className="rounded-sm border border-border-subtle px-3 py-2 text-sm md:col-span-2"
              />
              <Button
                size="sm"
                disabled={
                  sourceBusy ||
                  (!file && !sourceText.trim() && !youtubeUrl.trim())
                }
                onClick={uploadSource}
              >
                {sourceBusy ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}{" "}
                Add to program
              </Button>
            </div>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-6 sm:px-6">
          {detail.messages.map((message: ResearchMessage) => (
            <div
              key={message.message_id}
              className={
                message.role === "user"
                  ? "ml-auto max-w-2xl"
                  : "mr-auto max-w-3xl"
              }
            >
              <div
                className={
                  message.role === "user"
                    ? "rounded-md bg-text-institutional px-4 py-3 text-sm leading-6 text-white"
                    : "text-sm leading-7 text-text-institutional"
                }
              >
                <p className="whitespace-pre-wrap break-words">
                  {message.content}
                </p>
              </div>
              {proposalsByMessage.get(message.message_id)?.map((proposal) => (
                <CandidateProposal
                  key={proposal.proposal_id}
                  proposal={proposal}
                  programId={programId}
                  onDecision={reload}
                />
              ))}
              {message.parts.some((part) => part.type === "source_citation") ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {message.parts
                    .filter((part) => part.type === "source_citation")
                    .map((part) => {
                      if (part.type !== "source_citation") return null;
                      const source = detail.sources.find(
                        (item) => item.source_id === part.source_id,
                      );
                      return (
                        <span
                          key={`${part.source_id}:${part.chunk_id}`}
                          title={part.label}
                          className="inline-flex max-w-full items-center gap-1 rounded-sm border border-border-subtle bg-surface-white px-2 py-1 text-[10px] text-text-neutral"
                        >
                          <FileText className="h-3 w-3 shrink-0" />
                          <span className="truncate">
                            {source?.title ?? "Source"} ·{" "}
                            {part.chunk_id.slice(0, 8)}
                          </span>
                        </span>
                      );
                    })}
                </div>
              ) : null}
              {message.parts.some(
                (part) => part.type === "artifact_citation",
              ) ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {message.parts
                    .filter((part) => part.type === "artifact_citation")
                    .map((part) =>
                      part.type === "artifact_citation" ? (
                        <span
                          key={`${part.artifact_id}:${JSON.stringify(part.anchor)}`}
                          title={part.label}
                          className="inline-flex max-w-full items-center gap-1 rounded-sm border border-border-subtle bg-surface-white px-2 py-1 text-[10px] text-text-neutral"
                        >
                          <Link2 className="h-3 w-3 shrink-0" />
                          <span className="truncate">
                            {part.label} · {part.artifact_id.slice(0, 12)}
                          </span>
                        </span>
                      ) : null,
                    )}
                </div>
              ) : null}
              {message.role === "assistant" &&
              message.parts.some(
                (part) => part.type === "artifact_citation",
              ) ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() =>
                      proposeArtifactAction(message.message_id, "research_note")
                    }
                  >
                    Propose research note
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() =>
                      proposeArtifactAction(
                        message.message_id,
                        "next_experiment",
                      )
                    }
                  >
                    Propose next experiment
                  </Button>
                </div>
              ) : null}
              <p
                className={`mt-1 text-[10px] text-text-muted ${message.role === "user" ? "text-right" : ""}`}
              >
                {formatTime(message.created_at)}
              </p>
            </div>
          ))}
          {streamingText ? (
            <div className="mr-auto max-w-3xl whitespace-pre-wrap text-sm leading-7 text-text-institutional">
              {streamingText}
              <span className="ml-1 inline-block h-4 w-px animate-pulse bg-brand" />
            </div>
          ) : null}
          {busy && !streamingText ? (
            <div className="flex items-center gap-2 text-sm text-text-neutral">
              <LoaderCircle className="h-4 w-4 animate-spin" /> Inspecting the
              research record...
            </div>
          ) : null}
        </div>

        <div className="border-t border-border-subtle bg-surface-subtle p-3 sm:p-4">
          {selectedSources.length || selectedArtifacts.length ? (
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-text-neutral">
                Using {selectedSources.length} source
                {selectedSources.length === 1 ? "" : "s"} and{" "}
                {selectedArtifacts.length} artifact
                {selectedArtifacts.length === 1 ? "" : "s"} in this turn.
              </p>
              {selectedSources.length ? (
                <Button size="sm" variant="tertiary" onClick={draftSourceExtractionPrompt}>
                  Extract hypotheses from source
                </Button>
              ) : null}
            </div>
          ) : null}
          <div className="flex items-end gap-2 rounded-md border border-border-strong bg-surface-white p-2 shadow-sm">
            <textarea
              ref={composerRef}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send();
                }
              }}
              rows={3}
              maxLength={20000}
              placeholder="Describe an intuition, ask for options, or question a completed run..."
              className="min-h-[72px] flex-1 resize-none border-0 bg-transparent px-2 py-1 text-sm leading-6 outline-none"
            />
            {busy ? (
              <button
                type="button"
                aria-label="Stop response"
                onClick={() => requestControllerRef.current?.abort()}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-sm border border-border-strong bg-surface-white text-text-institutional"
              >
                <span className="h-3 w-3 rounded-[1px] bg-current" />
              </button>
            ) : (
              <button
                type="button"
                aria-label="Send message"
                onClick={send}
                disabled={content.trim().length < 2}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-sm bg-brand text-white disabled:opacity-40"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            )}
          </div>
          {error ? (
            <div className="mt-2 flex items-center justify-between gap-3 text-xs text-chart-negative">
              <span>{error}</span>
              <button
                onClick={() => void send()}
                className="inline-flex items-center gap-1"
              >
                <RotateCcw className="h-3 w-3" /> Retry
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <aside className="border-t border-border-subtle bg-surface-subtle p-4 lg:border-l lg:border-t-0">
        <p className="font-provenance text-[10px] uppercase text-text-muted">
          Research state
        </p>
        <div className="mt-4 space-y-4">
          <div>
            <p className="text-xs font-semibold text-text-institutional">
              Sources
            </p>
            {detail.sources.length ? (
              <div className="mt-2 space-y-2">
                {detail.sources.map((source) => (
                  <label
                    key={source.source_id}
                    className="flex items-start gap-2 text-xs leading-5 text-text-neutral"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSources.includes(source.source_id)}
                      onChange={(event) =>
                        setSelectedSources((current) =>
                          event.target.checked
                            ? [...new Set([...current, source.source_id])]
                            : current.filter((id) => id !== source.source_id),
                        )
                      }
                      className="mt-1"
                    />
                    <span className="min-w-0 break-words">
                      <span className="block font-medium text-text-institutional">
                        {source.title}
                      </span>
                      {source.source_type} · {source.status}
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs text-text-muted">
                No sources attached.
              </p>
            )}
          </div>
          <div className="border-t border-border-subtle pt-4">
            <p className="text-xs font-semibold text-text-institutional">
              Artifacts
            </p>
            {artifacts.length ? (
              <div className="mt-2 max-h-48 space-y-2 overflow-y-auto">
                {artifacts.slice(0, 50).map((artifact) => (
                  <label
                    key={artifact.catalog_id}
                    className="flex items-start gap-2 text-xs leading-5 text-text-neutral"
                  >
                    <input
                      type="checkbox"
                      checked={selectedArtifacts.includes(artifact.object_id)}
                      onChange={(event) =>
                        setSelectedArtifacts((current) =>
                          event.target.checked
                            ? [
                                ...new Set([...current, artifact.object_id]),
                              ].slice(0, 20)
                            : current.filter((id) => id !== artifact.object_id),
                        )
                      }
                      className="mt-1"
                    />
                    <span className="min-w-0">
                      <span className="block break-words font-medium text-text-institutional">
                        {artifact.summary}
                      </span>
                      {artifact.artifact_type} · {artifact.status}
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs text-text-muted">
                Refresh the artifact catalog to attach evidence directly.
              </p>
            )}
          </div>
          <div className="border-t border-border-subtle pt-4">
            <p className="text-xs font-semibold text-text-institutional">
              Proposals
            </p>
            <p className="mt-2 text-xs leading-5 text-text-neutral">
              {
                detail.proposals.filter((item) => item.status === "proposed")
                  .length
              }{" "}
              awaiting decision ·{" "}
              {
                detail.proposals.filter((item) => item.status === "confirmed")
                  .length
              }{" "}
              confirmed
            </p>
          </div>
          <div className="border-t border-border-subtle pt-4">
            <p className="text-xs font-semibold text-text-institutional">
              Authority boundary
            </p>
            <p className="mt-2 text-xs leading-5 text-text-neutral">
              {
                "Chat can read program context and draft proposals. It cannot approve specs, queue experiments, deploy strategies, or place orders."
              }
            </p>
          </div>
          <div className="border-t border-border-subtle pt-4">
            <p className="inline-flex items-center gap-1 text-xs font-semibold text-text-institutional">
              <Link2 className="h-3 w-3" /> Citations
            </p>
            <p className="mt-2 text-xs leading-5 text-text-neutral">
              Source and artifact claims must resolve to stored program
              evidence.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
