"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Command, FileQuestion, Loader2, Lock, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ValidationCommandLayer, ValidationCommand } from "@/lib/app/validation-command-layer";

function analysisIdFromPath(pathname: string | null) {
  return pathname?.match(/^\/app\/analyses\/([^/]+)/)?.[1];
}

export function ValidationCommandCenter() {
  const pathname = usePathname();
  const router = useRouter();
  const analysisId = analysisIdFromPath(pathname);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [layer, setLayer] = useState<ValidationCommandLayer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);

  const loadLayer = useCallback(async () => {
    if (!analysisId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/analyses/${analysisId}/command-layer`, { cache: "no-store" });
      const payload = await response.json() as ValidationCommandLayer & { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "Command layer unavailable.");
      setLayer(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Command layer unavailable.");
    } finally {
      setLoading(false);
    }
  }, [analysisId]);

  useEffect(() => {
    if (analysisId) void loadLayer();
  }, [analysisId, loadLayer]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k" && analysisId) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [analysisId]);

  const filteredCommands = useMemo(() => {
    const commands = layer?.commands ?? [];
    if (!query.trim()) return commands;
    const needle = query.toLowerCase();
    return commands.filter((command) => `${command.label} ${command.description} ${command.blocked_reason ?? ""}`.toLowerCase().includes(needle));
  }, [layer?.commands, query]);

  if (!analysisId) return null;

  async function runCommand(command: ValidationCommand) {
    if (command.kind === "blocked") return;
    if (command.kind === "navigate" && command.href) {
      setOpen(false);
      router.push(command.href);
      return;
    }
    if (command.kind === "api" && command.endpoint && command.method) {
      setRunning(command.id);
      setError(null);
      try {
        const response = await fetch(command.endpoint, {
          method: command.method,
          headers: { "content-type": "application/json" },
          body: command.body ? JSON.stringify(command.body) : undefined,
        });
        if (!response.ok) throw new Error("Command failed.");
        await loadLayer();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Command failed.");
      } finally {
        setRunning(null);
      }
    }
  }

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "gap-2")}
          onClick={() => setOpen(true)}
        >
          <Command className="h-4 w-4" />
          Validation Commands
          <span className="rounded-sm border border-border-subtle bg-surface-white px-1.5 py-0.5 font-provenance text-[10px] text-text-neutral">Ctrl K</span>
        </button>
        <Link href={`/app/analyses/${analysisId}/report#evidence-alerts`} className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "gap-2")}>
          <Bell className="h-4 w-4" />
          Alerts {layer?.alerts.length ? `(${layer.alerts.length})` : ""}
        </Link>
        <Link href={`/app/analyses/${analysisId}/report#case-file-timeline`} className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "gap-2")}>
          <FileQuestion className="h-4 w-4" />
          Case File
        </Link>
      </div>

      {open ? (
        <div className="fixed inset-0 z-[80] bg-black/30 px-4 py-10" role="dialog" aria-modal="true" onClick={() => setOpen(false)}>
          <div className="mx-auto max-h-[86vh] w-full max-w-4xl overflow-hidden rounded-md border border-border-subtle bg-surface-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center gap-3 border-b border-border-subtle px-4 py-3">
              <Search className="h-4 w-4 text-text-neutral" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                autoFocus
                placeholder="Ask for a validation action..."
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
              <button type="button" className="rounded-sm p-1 text-text-neutral hover:bg-surface-panel" onClick={() => setOpen(false)} aria-label="Close commands">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid max-h-[calc(86vh-52px)] overflow-y-auto lg:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-2 border-r border-border-subtle p-4">
                {loading ? <p className="flex items-center gap-2 text-sm text-text-neutral"><Loader2 className="h-4 w-4 animate-spin" /> Loading validation commands...</p> : null}
                {filteredCommands.map((command) => (
                  <button
                    key={command.id}
                    type="button"
                    onClick={() => void runCommand(command)}
                    disabled={command.kind === "blocked" || running === command.id}
                    className={cn(
                      "w-full rounded-sm border border-border-subtle px-3 py-3 text-left transition-colors",
                      command.kind === "blocked" ? "bg-surface-muted text-text-neutral" : "bg-surface-white hover:bg-surface-panel",
                    )}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-text-institutional">{command.label}</span>
                      {command.kind === "blocked" ? <Lock className="h-3.5 w-3.5 text-text-neutral" /> : null}
                      {running === command.id ? <Loader2 className="h-3.5 w-3.5 animate-spin text-research-red" /> : null}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-text-neutral">{command.blocked_reason ?? command.description}</span>
                  </button>
                ))}
                {error ? <p className="rounded-sm border border-chart-negative/20 bg-chart-negative/10 px-3 py-2 text-sm text-chart-negative">{error}</p> : null}
              </div>
              <div className="space-y-4 bg-surface-subtle p-4">
                <div>
                  <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">Saved validation questions</p>
                  <div className="mt-3 space-y-2">
                    {(layer?.saved_questions ?? []).slice(0, 7).map((item) => (
                      <div key={item.id} className="rounded-sm border border-border-subtle bg-surface-white p-3">
                        <p className="text-sm font-medium text-text-institutional">{item.question}</p>
                        <p className="mt-1 text-xs leading-5 text-text-neutral">{item.answer}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="font-provenance text-[10px] uppercase tracking-[0.12em] text-text-neutral">Latest evidence alerts</p>
                  <div className="mt-3 space-y-2">
                    {(layer?.alerts ?? []).slice(0, 5).map((item) => (
                      <div key={item.id} className="rounded-sm border border-border-subtle bg-surface-white p-3">
                        <p className="text-sm font-medium text-text-institutional">{item.title}</p>
                        <p className="mt-1 text-xs leading-5 text-text-neutral">{item.summary}</p>
                      </div>
                    ))}
                    {!layer?.alerts.length ? <p className="text-sm text-text-neutral">No evidence alerts have been emitted yet.</p> : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
