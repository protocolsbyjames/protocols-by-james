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

interface ReferralRow {
  id: string;
  status: "pending" | "credited" | "void";
  credit_cents: number;
  created_at: string;
  credited_at: string | null;
  referee: { full_name: string | null } | null;
}

export default function ClientSettingsPage() {
  const supabase = createClient();

  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [linkCopied, setLinkCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: profile }, { data: sub }, { data: referralRows }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("full_name, avatar_url, referral_code")
            .eq("id", user.id)
            .maybeSingle(),
          supabase
            .from("subscriptions")
            .select("status, price, current_period_end, stripe_customer_id")
            .eq("user_id", user.id)
            .maybeSingle(),
          supabase
            .from("referrals")
            .select(
              "id, status, credit_cents, created_at, credited_at, referee:profiles!referrals_referee_id_fkey(full_name)",
            )
            .eq("referrer_id", user.id)
            .order("created_at", { ascending: false }),
        ]);

      if (profile) {
        setFullName(profile.full_name ?? "");
        setAvatarUrl(profile.avatar_url ?? "");
        setReferralCode(profile.referral_code ?? null);
      }
      if (sub) {
        setSubscription(sub);
      }
      if (referralRows) {
        // Supabase can return the joined relation as an array or object
        // depending on the FK cardinality inference. Normalize to a single object.
        const normalized = (referralRows as unknown as ReferralRow[]).map((r) => ({
          ...r,
          referee: Array.isArray(r.referee) ? r.referee[0] ?? null : r.referee,
        }));
        setReferrals(normalized);
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

  const referralLink = referralCode
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/signup?ref=${referralCode}`
    : "";

  async function handleCopyReferralLink() {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    } catch {
      // Fallback: select the input so the user can copy manually
    }
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

      {/* Referrals */}
      <Card>
        <CardHeader>
          <CardTitle>Refer a friend</CardTitle>
          <CardDescription>
            Share your link — when a friend signs up and pays for their first
            month, you get a $20 credit and they get $20 off.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {referralCode ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="referralLink">Your referral link</Label>
                <div className="flex gap-2">
                  <Input
                    id="referralLink"
                    value={referralLink}
                    readOnly
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCopyReferralLink}
                  >
                    {linkCopied ? "Copied!" : "Copy"}
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <p className="text-sm font-medium">Your referrals</p>
                {referrals.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No referrals yet. Share your link to get started.
                  </p>
                ) : (
                  <ul className="divide-y rounded-md border">
                    {referrals.map((r) => (
                      <li
                        key={r.id}
                        className="flex items-center justify-between px-3 py-2 text-sm"
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {r.referee?.full_name ?? "Pending signup"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Joined {formatDate(r.created_at)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            ${(r.credit_cents / 100).toFixed(0)}
                          </span>
                          <Badge
                            variant={
                              r.status === "credited"
                                ? "default"
                                : r.status === "void"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {r.status.charAt(0).toUpperCase() +
                              r.status.slice(1)}
                          </Badge>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Your referral link will appear here once your profile finishes
              setting up.
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
