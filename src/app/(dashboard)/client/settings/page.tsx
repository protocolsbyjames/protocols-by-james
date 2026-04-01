"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

interface Subscription {
  status: string;
  price: number | null;
  current_period_end: string | null;
  stripe_customer_id: string | null;
}

export default function ClientSettingsPage() {
  const supabase = createClient();

  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: profile }, { data: sub }] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, avatar_url")
          .eq("id", user.id)
          .single(),
        supabase
          .from("subscriptions")
          .select("status, price, current_period_end, stripe_customer_id")
          .eq("user_id", user.id)
          .single(),
      ]);

      if (profile) {
        setFullName(profile.full_name ?? "");
        setAvatarUrl(profile.avatar_url ?? "");
      }
      if (sub) {
        setSubscription(sub);
      }
      setLoading(false);
    }

    loadData();
  }, [supabase]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        avatar_url: avatarUrl,
      })
      .eq("id", user.id);

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  async function handleManageSubscription() {
    // Redirect to Stripe Customer Portal via API route
    const res = await fetch("/api/stripe/customer-portal", { method: "POST" });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    }
  }

  function formatDate(dateString: string | null) {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function statusVariant(status: string) {
    switch (status) {
      case "active":
        return "default" as const;
      case "trialing":
        return "secondary" as const;
      case "past_due":
      case "canceled":
        return "destructive" as const;
      default:
        return "outline" as const;
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your profile and subscription.
        </p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your personal information.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="avatarUrl">Avatar URL</Label>
            <Input
              id="avatarUrl"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/photo.jpg"
            />
          </div>
        </CardContent>
      </Card>

      {/* Subscription */}
      <Card>
        <CardHeader>
          <CardTitle>Subscription</CardTitle>
          <CardDescription>
            Your current plan and billing details.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {subscription ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Status</span>
                <Badge variant={statusVariant(subscription.status)}>
                  {subscription.status.charAt(0).toUpperCase() +
                    subscription.status.slice(1)}
                </Badge>
              </div>
              {subscription.price != null && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Monthly Price</span>
                  <span className="text-sm text-muted-foreground">
                    ${subscription.price.toFixed(2)} / month
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Next Billing Date</span>
                <span className="text-sm text-muted-foreground">
                  {formatDate(subscription.current_period_end)}
                </span>
              </div>

              <Separator />

              <Button
                variant="outline"
                onClick={handleManageSubscription}
              >
                Manage Subscription
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No active subscription found. Contact your coach to get started.
            </p>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Save */}
      <div className="flex items-center gap-4">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
        {saved && (
          <span className="text-sm text-emerald-600">
            Profile saved successfully.
          </span>
        )}
      </div>
    </div>
  );
}
