"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function SubscribeButton({ planId }: { planId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubscribe() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });

      const body = (await res.json()) as { url?: string; error?: string };

      if (!res.ok || !body.url) {
        setError(body.error ?? "Unable to start checkout. Please try again.");
        setLoading(false);
        return;
      }

      window.location.href = body.url;
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        className="w-full"
        size="lg"
        onClick={handleSubscribe}
        disabled={loading}
      >
        {loading ? "Redirecting to checkout…" : "Subscribe"}
      </Button>
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
