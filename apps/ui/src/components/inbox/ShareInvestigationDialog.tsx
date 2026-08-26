"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Link2, Loader2, Share2, Trash2, X } from "lucide-react";
import type { ShareScope } from "@/lib/investigations";
import { Button } from "@/components/ui/button";

interface ManagedShare {
  id: string;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export function ShareInvestigationDialog({
  investigationId,
  open,
  onOpenChange,
}: {
  investigationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [scope, setScope] = useState<ShareScope>("proven");
  const [expiry, setExpiry] = useState<"7" | "30" | "never">("30");
  const [creating, setCreating] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [shares, setShares] = useState<ManagedShare[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function loadShares() {
    const response = await fetch(`/api/investigations/${investigationId}/shares`, { cache: "no-store" });
    if (!response.ok) return;
    const payload = (await response.json()) as { shares: ManagedShare[] };
    setShares(payload.shares);
  }

  useEffect(() => {
    if (open) void loadShares();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, investigationId]);

  if (!open) return null;

  async function create() {
    setCreating(true);
    setError(null);
    try {
      const response = await fetch(`/api/investigations/${investigationId}/shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          expiresInDays: expiry === "never" ? null : Number(expiry),
        }),
      });
      const payload = (await response.json()) as { share?: { url: string }; error?: string };
      if (!response.ok || !payload.share) throw new Error(payload.error ?? "Could not create the share link.");
      setUrl(payload.share.url);
      await navigator.clipboard.writeText(payload.share.url);
      setCopied(true);
      await loadShares();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create the share link.");
    } finally {
      setCreating(false);
    }
  }

  async function revoke(shareId: string) {
    const response = await fetch(`/api/shares/${shareId}`, { method: "DELETE" });
    if (response.ok) await loadShares();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true">
      <button className="absolute inset-0" aria-label="Close share dialog" onClick={() => onOpenChange(false)} />
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-[22px] border border-border bg-card shadow-ht-md">
        <div className="flex items-start justify-between border-b border-border px-6 py-5">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Share2 className="h-4 w-4" aria-hidden /> Share investigation
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Create an immutable, revocable snapshot.</p>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-6">
          <label className="block">
            <span className="text-xs font-medium text-foreground">Snapshot contents</span>
            <select
              value={scope}
              onChange={(event) => setScope(event.target.value as ShareScope)}
              className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-hidden focus:ring-2 focus:ring-ring/20"
            >
              <option value="proven">Proven results only</option>
              <option value="transcript">Proven results and transcript</option>
              <option value="full">Full investigation, including ruled-out evidence</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-foreground">Link expires</span>
            <select
              value={expiry}
              onChange={(event) => setExpiry(event.target.value as typeof expiry)}
              className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-hidden focus:ring-2 focus:ring-ring/20"
            >
              <option value="7">In 7 days</option>
              <option value="30">In 30 days</option>
              <option value="never">Never</option>
            </select>
          </label>

          {url && (
            <div className="flex items-center gap-2 rounded-2xl border border-ht-green-border bg-ht-green-bg p-3.5">
              <Link2 className="h-4 w-4 shrink-0 text-ht-green" aria-hidden />
              <input readOnly value={url} className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-hidden" />
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(url);
                  setCopied(true);
                }}
                className="rounded-sm p-1 text-ht-green"
                aria-label="Copy link"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          )}

          {error && <p role="alert" className="text-sm text-ht-danger-text">{error}</p>}

          {shares.some((share) => !share.revokedAt) && (
            <section>
              <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Active snapshots</h3>
              <ul className="mt-2 space-y-1.5">
                {shares
                  .filter((share) => !share.revokedAt)
                  .map((share) => (
                    <li key={share.id} className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2.5 text-xs">
                      <span className="text-muted-foreground">
                        Created {new Date(share.createdAt).toLocaleDateString()} ·{" "}
                        {share.expiresAt ? `expires ${new Date(share.expiresAt).toLocaleDateString()}` : "never expires"}
                      </span>
                      <button
                        onClick={() => revoke(share.id)}
                        className="rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-ht-danger-text"
                        aria-label="Revoke snapshot"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
              </ul>
            </section>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border bg-muted/25 px-6 py-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={create} disabled={creating}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
            Create snapshot
          </Button>
        </div>
      </div>
    </div>
  );
}
