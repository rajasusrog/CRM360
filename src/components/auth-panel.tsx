"use client";

import { useState } from "react";
import Link from "next/link";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { supabasePublicConfig } from "@/lib/supabase/public-env";
import { brand } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { resolvePostAuthDestination } from "@/server/actions/auth";

const supabaseConfig = supabasePublicConfig();
const supabaseConfigured = supabaseConfig.configured;

export function AuthPanel({
  mode,
  nextPath = "",
  initialError = null,
  demoEnabled = false,
  appOrigin = "",
}: {
  mode: "login" | "signup";
  nextPath?: string;
  initialError?: string | null;
  demoEnabled?: boolean;
  appOrigin?: string;
}) {
  const unconfigured = !supabaseConfigured;
  const showDemo = demoEnabled && mode === "login";
  const [message, setMessage] = useState<string | null>(initialError);
  const [pending, setPending] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState(showDemo ? "rajesh.iyer@kaveri.test" : "");
  const [password, setPassword] = useState(showDemo ? "Kaveri#2026" : "");

  function callbackUrl() {
    const origin = appOrigin || window.location.origin;
    const url = new URL("/auth/callback", origin);
    if (nextPath) url.searchParams.set("next", nextPath);
    return url.toString();
  }

  async function magic() {
    setPending(true);
    setMessage(null);
    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl() },
    });
    setPending(false);
    setMessage(error ? error.message : "Check your email for the sign-in link.");
  }

  async function passwordSignIn() {
    setPending(true);
    setMessage(null);
    const supabase = createBrowserSupabase();

    if (mode === "signup") {
      const result = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: callbackUrl(),
        },
      });
      if (result.error) {
        setPending(false);
        setMessage(result.error.message);
        return;
      }
      if (!result.data.session) {
        setPending(false);
        setMessage("Account created. Check your email to confirm your address before signing in.");
        return;
      }
    } else {
      const result = await supabase.auth.signInWithPassword({ email, password });
      if (result.error) {
        setPending(false);
        setMessage(result.error.message);
        return;
      }
    }

    try {
      const { destination } = await resolvePostAuthDestination(nextPath || null);
      window.location.assign(destination);
    } catch {
      setPending(false);
      setMessage("Signed in, but could not verify your destination. Reload to continue.");
    }
  }

  async function google() {
    setPending(true);
    setMessage(null);
    const base = supabaseConfig.url;
    const key = supabaseConfig.key;
    try {
      const settings = await fetch(`${base}/auth/v1/settings`, { headers: { apikey: key } }).then((response) => response.json());
      if (!settings?.external?.google) {
        setMessage("Google sign-in is not turned on for this project yet. Use email sign-in.");
        setPending(false);
        return;
      }
    } catch {
      setMessage("Could not reach sign-in. Try again shortly.");
      setPending(false);
      return;
    }

    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl() },
    });
    if (error) {
      setPending(false);
      setMessage(error.message);
    }
  }

  return (
    <div className="mx-auto grid min-h-screen max-w-5xl items-center gap-10 px-5 py-10 lg:grid-cols-2">
      <div>
        <Link href="/">
          <img src="/brand/logo.jpg" alt="Unikorn360 Business Intelligence" className="w-56 rounded-xl" />
        </Link>
        <h1 className="mt-6 font-display text-4xl leading-tight text-primary">{mode === "login" ? "Sign in to the desk." : "Open a firm workspace."}</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {showDemo
            ? "Magic link is the usual way in. Demo mode is enabled for this isolated workspace."
            : "Sign in with your firm email and password, a magic link, or Google."}
        </p>
        {showDemo ? (
          <dl className="mt-6 space-y-2 rounded-xl bg-card p-4 text-sm ring-1 ring-foreground/10">
            <div className="flex justify-between gap-4"><dt>Owner</dt><dd>rajesh.iyer@kaveri.test</dd></div>
            <div className="flex justify-between gap-4"><dt>Password</dt><dd>Kaveri#2026</dd></div>
            <div className="flex justify-between gap-4"><dt>Client portal</dt><dd>murugan.textiles@client.test</dd></div>
            <div className="flex justify-between gap-4"><dt>Portal password</dt><dd>Portal#2026</dd></div>
          </dl>
        ) : null}
        <p className="mt-6 text-sm text-muted-foreground">
          {brand.founder}, {brand.role}
          <br />
          {brand.phone} · {brand.email}
          <br />
          VK Complex, P.J.N. Road, Vaniyambadi, Tamil Nadu 635751
        </p>
      </div>
      <div className="grid gap-4 rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
        {unconfigured ? (
          <p className="text-sm text-destructive">
            Sign-in is not configured on this deployment. The build did not receive SUPABASE_URL and SUPABASE_ANON_KEY.
          </p>
        ) : null}
        {mode === "signup" ? (
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted-foreground">Your name</span>
            <input value={fullName} onChange={(event) => setFullName(event.target.value)} className="h-9 rounded-lg border border-input bg-background px-2.5" />
          </label>
        ) : null}
        <label className="grid gap-1.5 text-sm">
          <span className="text-muted-foreground">Email</span>
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-9 rounded-lg border border-input bg-background px-2.5"
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="text-muted-foreground">Password</span>
          <input
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-9 rounded-lg border border-input bg-background px-2.5"
          />
        </label>
        <Button type="button" disabled={unconfigured || pending || !email || !password} onClick={passwordSignIn}>
          {mode === "login" ? "Sign in with password" : "Create account with password"}
        </Button>
        <Button type="button" variant="outline" disabled={unconfigured || pending || !email} onClick={magic}>
          Email me a magic link
        </Button>
        <Button type="button" variant="secondary" disabled={unconfigured || pending} onClick={google}>
          Continue with Google
        </Button>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        <p className="text-sm text-muted-foreground">
          {mode === "login" ? <Link href="/signup">New firm</Link> : <Link href="/login">Already have a login</Link>}
        </p>
      </div>
    </div>
  );
}
