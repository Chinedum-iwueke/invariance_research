"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { KeyRound, PlugZap, RotateCw, Trash2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LlmConnection = {
  connection_id: string;
  provider: "openai";
  label: string;
  status: "active" | "revoked";
  api_key_hint: string;
  default_model: string;
  usage_mode: "byok";
  last_checked_at?: string;
  last_error?: string;
  last_used_at?: string;
  created_at: string;
};

export function LlmProviderSettings({ connections }: { connections: LlmConnection[] }) {
  const router = useRouter();
  const active = connections.find((connection) => connection.provider === "openai" && connection.status === "active");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(active?.default_model ?? "gpt-4.1-mini");
  const [label, setLabel] = useState(active?.label ?? "OpenAI API key");
  const [busy, setBusy] = useState<"test" | "save" | "revoke" | undefined>();
  const [message, setMessage] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  async function post(action: string, payload: Record<string, unknown>) {
    setError(undefined);
    setMessage(undefined);
    const response = await fetch("/api/settings/llm-connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error?.message ?? "Provider action failed.");
    return data;
  }

  async function testConnection() {
    try {
      setBusy("test");
      const result = await post("test_openai", { api_key: apiKey, model });
      setMessage(`Connection verified with ${result.result.model}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Connection test failed.");
    } finally {
      setBusy(undefined);
    }
  }

  async function saveConnection() {
    try {
      setBusy("save");
      await post("save_openai", { api_key: apiKey, model, label });
      setApiKey("");
      setMessage("OpenAI connector saved. Future Research Desk turns will use this key.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save connector.");
    } finally {
      setBusy(undefined);
    }
  }

  async function revokeConnection() {
    if (!active) return;
    try {
      setBusy("revoke");
      await post("revoke", { connection_id: active.connection_id });
      setMessage("OpenAI connector revoked. Hosted inference will be used when enabled.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to revoke connector.");
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-sm border border-border-subtle bg-surface-white p-3">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-text-neutral"><PlugZap className="h-3.5 w-3.5" /> Active provider</p>
          <p className="mt-2 text-sm font-medium text-text-institutional">{active ? "OpenAI BYOK" : "Hosted Invariance inference"}</p>
        </div>
        <div className="rounded-sm border border-border-subtle bg-surface-white p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-neutral">Model</p>
          <p className="mt-2 text-sm font-medium text-text-institutional">{active?.default_model ?? model}</p>
        </div>
        <div className="rounded-sm border border-border-subtle bg-surface-white p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-neutral">Key</p>
          <p className="mt-2 text-sm font-medium text-text-institutional">{active?.api_key_hint ?? "Not connected"}</p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_0.75fr]">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-text-neutral">OpenAI API key</span>
          <input
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="sk-..."
            autoComplete="off"
            className="mt-2 min-h-11 w-full rounded-sm border border-border-subtle bg-surface-white px-3 py-2 text-sm outline-none focus:border-brand"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-text-neutral">Default model</span>
          <input
            value={model}
            onChange={(event) => setModel(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-sm border border-border-subtle bg-surface-white px-3 py-2 text-sm outline-none focus:border-brand"
          />
        </label>
        <label className="block lg:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-text-neutral">Label</span>
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-sm border border-border-subtle bg-surface-white px-3 py-2 text-sm outline-none focus:border-brand"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy !== undefined || !apiKey.trim()} onClick={testConnection} className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "disabled:opacity-60")}>
          <RotateCw className="mr-2 h-4 w-4" /> {busy === "test" ? "Testing..." : "Test key"}
        </button>
        <button type="button" disabled={busy !== undefined || !apiKey.trim()} onClick={saveConnection} className={cn(buttonVariants({ size: "sm" }), "disabled:opacity-60")}>
          <KeyRound className="mr-2 h-4 w-4" /> {busy === "save" ? "Saving..." : "Save and use OpenAI"}
        </button>
        {active ? (
          <button type="button" disabled={busy !== undefined} onClick={revokeConnection} className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "disabled:opacity-60")}>
            <Trash2 className="mr-2 h-4 w-4" /> {busy === "revoke" ? "Revoking..." : "Revoke BYOK"}
          </button>
        ) : null}
      </div>

      {message ? <p className="rounded-sm border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-900">{message}</p> : null}
      {error ? <p className="rounded-sm border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm text-red-900">{error}</p> : null}

      <p className="text-xs leading-relaxed text-text-neutral">
        Stored keys are encrypted and never displayed after save. When active, Research Desk assistant turns use your OpenAI key directly; Invariance still controls tool access, citations, approvals, and backtest execution.
      </p>
    </div>
  );
}
