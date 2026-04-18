import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { SubscribeButton } from "./subscribe-button";

type Plan = {
  id: string;
  coach_id: string;
  name: string;
  description: string | null;
  features: string[];
  price_cents: number;
  currency: string;
  interval: "month" | "year";
  plan_type: "self_guided" | "coaching" | "addon";
  stripe_program_price_id: string | null;
  auto_include_addon_id: string | null;
  sort_order: number;
  coach: { full_name: string; avatar_url: string | null } | null;
};

const HYBRID_PROGRAM_CENTS = 3999; // $39.99 one-time program access

function formatRecurring(cents: number, currency: string, interval: string) {
  const dollars = (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  });
  return `${dollars}/${interval}`;
}

function formatHybridPrice(
  recurringCents: number,
  currency: string,
  interval: string,
) {
  const oneTime = (HYBRID_PROGRAM_CENTS / 100).toLocaleString("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  });
  const recurring = (recurringCents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  });
  return `${oneTime} + ${recurring}/${interval}`;
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) redirect("/login");
  if (profile.role === "coach") redirect("/coach");

  const { data: hasActive } = await supabase.rpc(
    "current_user_has_active_subscription",
  );
  if (hasActive === true) redirect("/client");

  const { data: plans } = await supabase
    .from("coaching_plans")
    .select(
      "id, coach_id, name, description, features, price_cents, currency, interval, plan_type, stripe_program_price_id, auto_include_addon_id, sort_order, coach:profiles!coaching_plans_coach_id_fkey(full_name, avatar_url)",
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const allPlans = (plans ?? []) as unknown as Plan[];
  const selfGuided = allPlans.filter((p) => p.plan_type === "self_guided");
  const coaching = allPlans.filter((p) => p.plan_type === "coaching");
  const addons = allPlans.filter((p) => p.plan_type === "addon");

  // The VIP add-on (only one expected). Coaching tiers can optionally attach it.
  const vipAddon = addons[0] ?? null;

  const { checkout } = await searchParams;

  return (
    <div className="min-h-screen bg-background px-4 py-12 sm:py-20">
      <div className="mx-auto max-w-5xl space-y-16">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Choose your plan
          </h1>
          <p className="text-sm text-muted-foreground">
            Pick a self-guided program or get 1:1 coaching. Cancel anytime from
            your settings.
          </p>
        </div>

        {checkout === "canceled" && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Checkout was canceled. No charge was made. Pick a plan to try
            again.
          </div>
        )}

        {allPlans.length === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>No plans available yet</CardTitle>
              <CardDescription>
                Coaching plans haven&apos;t been published yet. Check back
                soon.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {selfGuided.length > 0 && (
          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                Self-Guided Programs
              </h2>
              <p className="text-sm text-muted-foreground">
                One-time program access plus $14.99/mo for the training app.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {selfGuided.map((plan) => (
                <Card key={plan.id} className="flex flex-col">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{plan.name}</CardTitle>
                      <Badge variant="secondary">
                        {formatHybridPrice(
                          plan.price_cents,
                          plan.currency,
                          plan.interval,
                        )}
                      </Badge>
                    </div>
                    {plan.description && (
                      <CardDescription>{plan.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col justify-between gap-6">
                    {plan.features.length > 0 && (
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        {plan.features.map((feature, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <SubscribeButton planId={plan.id} />
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {coaching.length > 0 && (
          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                1:1 Coaching
              </h2>
              <p className="text-sm text-muted-foreground">
                Direct coaching with James: check-ins, feedback, and plan
                adjustments.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {coaching.map((plan) => {
                const vipIncluded = plan.auto_include_addon_id !== null;
                return (
                  <Card key={plan.id} className="flex flex-col">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-base">
                          {plan.name}
                        </CardTitle>
                        <Badge variant="secondary">
                          {formatRecurring(
                            plan.price_cents,
                            plan.currency,
                            plan.interval,
                          )}
                        </Badge>
                      </div>
                      {plan.description && (
                        <CardDescription>{plan.description}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="flex flex-1 flex-col justify-between gap-6">
                      {plan.features.length > 0 && (
                        <ul className="space-y-2 text-sm text-muted-foreground">
                          {plan.features.map((feature, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                              <span>{feature}</span>
                            </li>
                          ))}
                          {vipIncluded && (
                            <li className="flex items-start gap-2">
                              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                              <span>
                                <strong>VIP Community</strong> included
                              </span>
                            </li>
                          )}
                        </ul>
                      )}
                      <SubscribeButton
                        planId={plan.id}
                        vipAddon={
                          vipAddon && !vipIncluded
                            ? {
                                id: vipAddon.id,
                                priceCents: vipAddon.price_cents,
                                currency: vipAddon.currency,
                                interval: vipAddon.interval,
                              }
                            : null
                        }
                      />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
