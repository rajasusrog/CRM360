"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type Result = { error?: string; ok?: string; url?: string; body?: string } | void;

export function ActionForm({
  action,
  children,
  className,
}: {
  action: (formData: FormData) => Promise<Result>;
  children: React.ReactNode;
  className?: string;
}) {
  const [message, setMessage] = useState<{ tone: "bad" | "good"; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className={className}
      action={async (formData) => {
        setPending(true);
        setMessage(null);
        const result = await action(formData);
        setPending(false);
        if (!result) return;
        if (result.url) {
          window.location.href = result.url;
          return;
        }
        if (result.error) setMessage({ tone: "bad", text: result.error });
        else if (result.ok) setMessage({ tone: "good", text: result.ok });
      }}
    >
      <fieldset disabled={pending} className="grid gap-3 disabled:opacity-70">
        {children}
      </fieldset>
      {message ? (
        <p className={message.tone === "bad" ? "mt-2 text-sm text-destructive" : "mt-2 text-sm text-primary"}>{message.text}</p>
      ) : null}
    </form>
  );
}

export function Submit({ children }: { children: React.ReactNode }) {
  return (
    <Button type="submit" className="w-fit">
      {children}
    </Button>
  );
}
