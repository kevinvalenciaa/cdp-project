"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Sparkles } from "lucide-react";
import type { InvestigationDetail } from "@/lib/investigations";
import { PromptInputBox } from "@/components/ui/ai-prompt-box";
import { SidebarTrigger } from "@/components/ui/sidebar";

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
      router.push(`/investigations/${payload.investigation.id}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create the investigation.");
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-[calc(100dvh-4rem)] items-center justify-center p-4 sm:p-6 lg:min-h-full lg:p-8">
      {/* The only nav affordance on this route below md, where the rail is a sheet. */}
      <SidebarTrigger className="absolute left-4 top-4 md:hidden" />
      <div className="w-full max-w-3xl px-5 py-10 text-center sm:px-10 sm:py-14">
        {/* Same neumorphic plate the dashboard stat glyphs sit on. */}
        <div className="mx-auto flex size-14 items-center justify-center rounded-lg border border-[#FAFDFF] bg-white shadow-[0.5px_0.5px_3px_0_rgba(0,0,0,0.15),-4px_-4px_4px_0_rgba(0,0,0,0.02)_inset,2px_2px_4px_0_rgba(0,122,146,0.15)_inset]">
          <Sparkles className="size-6 text-ht-teal" aria-hidden />
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-[-0.02em] text-foreground">Start an investigation</h1>
        <p className="mx-auto mt-1.5 max-w-lg text-sm text-muted-foreground">
          Describe the business outcome. The agent team will scan the warehouse, verify every claim, and keep this
          investigation available for contextual follow-ups.
        </p>
        <div className="mx-auto mt-8 max-w-2xl text-left">
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
