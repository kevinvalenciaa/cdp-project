"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Button } from "@/components/ui/button";

export function LoginClient({ configured, error = null }: { configured: boolean; error?: string | null }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [callbackError, setCallbackError] = useState<string | null>(error);

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    if (!configured) {
      window.location.assign("/");
      return;
    }
    setLoading(true);
    setCallbackError(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setMessage(error ? error.message : "Check your email for the secure sign-in link.");
    setLoading(false);
  }

  return (
    <main id="main" className="flex min-h-dvh items-center justify-center bg-[#e9eef5] p-4 sm:p-6">
      <div className="w-full max-w-md rounded-[24px] border border-white/80 bg-card p-6 shadow-ht-md sm:p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ht-teal-tint">
          <Sparkles className="h-6 w-6 text-ht-teal" aria-hidden />
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-[-0.025em] text-foreground">Sign in to Proofloop</h1>
        <p className="mt-1 text-sm text-muted-foreground">Use your workspace email to continue.</p>
        {callbackError && (
          <p role="alert" className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {callbackError}
          </p>
        )}
        <form onSubmit={signIn} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-xs font-medium text-foreground">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1.5 h-11 w-full rounded-md border border-input bg-background px-3.5 text-sm outline-hidden focus:border-ht-400 focus:ring-2 focus:ring-ring/20"
              placeholder="you@company.com"
            />
          </label>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {configured ? "Email me a sign-in link" : "Continue in local demo"}
          </Button>
        </form>
        {message && <p className="mt-3 text-sm text-muted-foreground">{message}</p>}
      </div>
    </main>
  );
}
