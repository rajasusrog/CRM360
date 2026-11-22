"use client";

import { useState } from "react";
import Link from "next/link";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { brand } from "@/lib/brand";
import { Button } from "@/components/ui/button";

export function AuthPanel({ mode }: { mode: "login" | "signup" }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState(mode === "login" ? "rajesh.iyer@kaveri.test" : "");
  const [password, setPassword] = useState(mode === "login" ? "Kaveri#2026" : "");

  async function magic() {
    setPending(true);
    setMessage(null);
    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setPending(false);
    setMessage(error ? error.message : "Check your email for the sign-in link. Locally, open Mailpit.");
  }

  async function passwordSignIn() {
    setPending(true);
    setMessage(null);
    const supabase = createBrowserSupabase();
    const result =
      mode === "signup"
        ? await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { full_name: fullName },
              emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
          })
        : await supabase.auth.signInWithPassword({ email, password });
    setPending(false);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    window.location.assign("/dashboard");
  }

  async function google() {
    setPending(true);
    setMessage(null);
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    try {
      const settings = await fetch(`${base}/auth/v1/settings`, { headers: { apikey: key ?? "" } }).then((response) => response.json());
      if (!settings?.external?.google) {
        setMessage("Google sign-in is not turned on for this project yet. Use Sign in with password. To enable Google, add a Google OAuth client id and secret, then turn the provider on in Supabase.");
        return;
      }
    } catch {
      setMessage("Could not reach sign-in. Try the password on this page.");
      return;
    } finally {
      setPending(false);
    }
    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setMessage(error.message);
  }

  return (
    <div className="mx-auto grid min-h-screen max-w-5xl items-center gap-10 px-5 py-10 lg:grid-cols-2">
      <div>
        <Link href="/">
          <img src="/brand/logo.jpg" alt="Unikorn360 Business Intelligence" className="w-56 rounded-xl" />
        </Link>
        <h1 className="mt-6 font-display text-4xl leading-tight text-primary">{mode === "login" ? "Sign in to the desk." : "Open a firm workspace."}</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Magic link is the usual way in. The seeded Chennai firm also has a password so you can look around without an inbox.
        </p>
        {mode === "login" ? (
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
        <Button type="button" disabled={pending || !email || !password} onClick={passwordSignIn}>
          {mode === "login" ? "Sign in with password" : "Create account with password"}
        </Button>
        <Button type="button" variant="outline" disabled={pending || !email} onClick={magic}>
          Email me a magic link
        </Button>
        <Button type="button" variant="secondary" onClick={google}>
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
