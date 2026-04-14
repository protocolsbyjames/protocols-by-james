"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type VipAddon = {
  id: string;
  priceCents: number;
  currency: string;
  interval: "month" | "year";
};

function formatAddonPrice(addon: VipAddon) {
  const dollars = (addon.priceCents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: addon.currency.toUpperCase(),
  });
  return `${dollars}/${addon.interval}`;
}

export function SubscribeButton({
  planId,
  vipAddon = null,
}: {
  planId: string;
  vipAddon?: VipAddon | null;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addVip, setAddVip] = useState(false);

  async function handleSubscribe() {
    setLoading(true);
    setError(null);

    try {
      const addonPlanIds: string[] = [];
      if (vipAddon && addVip) addonPlanIds.push(vipAddon.id);

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, addonPlanIds }),
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
    <div className="space-y-3">
      {vipAddon && (
        <label className="flex items-start gap-2 rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-700">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={addVip}
            onChange={(e) => setAddVip(e.target.checked)}
            disabled={loading}
          />
          <span>
            Add <strong>VIP Community</strong> ({formatAddonPrice(vipAddon)})
          </span>
        </label>
      )}
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
