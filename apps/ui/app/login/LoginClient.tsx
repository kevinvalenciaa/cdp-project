"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Button } from "@/components/ui/button";

export function LoginClient({ configured }: { configured: boolean }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    if (!configured) {
      window.location.assign("/");
      return;
    }
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setMessage(error ? error.message : "Check your email for the secure sign-in link.");
    setLoading(false);
  }

  return (
    <main id="main" className="flex min-h-screen items-center justify-center bg-ht-50 p-5">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-ht-md">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ht-teal-tint">
          <Sparkles className="h-5 w-5 text-ht-teal" aria-hidden />
        </div>
        <h1 className="mt-4 text-xl font-semibold text-foreground">Sign in to Lift Compass</h1>
        <p className="mt-1 text-sm text-muted-foreground">Use your workspace email to continue.</p>
        <form onSubmit={signIn} className="mt-5 space-y-3">
          <label className="block">
            <span className="text-xs font-medium text-foreground">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-ht-400"
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
