"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Sparkles } from "lucide-react";
import type { InvestigationDetail } from "@/lib/investigations";
import { PromptInputBox } from "@/components/ui/ai-prompt-box";

export function NewInvestigationClient() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(raw: string) {
    const content = raw.replace(/^\[(?:Search|Think): ([\s\S]*)\]$/, "$1").trim();
    if (!content || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/investigations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, clientMessageId: crypto.randomUUID(), intentHint: "investigate" }),
      });
      const payload = (await response.json()) as { investigation?: InvestigationDetail; error?: string };
      if (!response.ok || !payload.investigation) throw new Error(payload.error ?? "Could not create the investigation.");
      router.push(`/opportunities/${payload.investigation.id}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create the investigation.");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center px-5 py-10 lg:min-h-screen">
      <div className="w-full max-w-2xl text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-ht-teal-tint">
          <Sparkles className="h-5 w-5 text-ht-teal" aria-hidden />
        </div>
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-foreground">Start an investigation</h1>
        <p className="mx-auto mt-1.5 max-w-lg text-sm text-muted-foreground">
          Describe the business outcome. The agent team will scan the warehouse, verify every claim, and keep this
          investigation available for contextual follow-ups.
        </p>
        <div className="mt-7 text-left">
          <PromptInputBox onSend={create} isLoading={submitting} placeholder="What should the agents investigate?" />
        </div>
        {error && (
          <div role="alert" className="mt-4 flex items-center justify-center gap-2 text-sm text-ht-danger-text">
            <AlertTriangle className="h-4 w-4" aria-hidden /> {error}
          </div>
        )}
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          Every promoted opportunity must survive holdout verification.
        </p>
      </div>
    </div>
  );
}
