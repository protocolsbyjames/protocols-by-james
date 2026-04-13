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
  sort_order: number;
  coach: { full_name: string; avatar_url: string | null } | null;
};

function formatPrice(cents: number, currency: string, interval: string) {
  const dollars = (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
  });
  return `${dollars}/${interval}`;
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

  // Skip onboarding if the client already has an active subscription.
  const { data: hasActive } = await supabase.rpc(
    "current_user_has_active_subscription",
  );
  if (hasActive === true) redirect("/client");

  const { data: plans } = await supabase
    .from("coaching_plans")
    .select(
      "id, coach_id, name, description, features, price_cents, currency, interval, sort_order, coach:profiles!coaching_plans_coach_id_fkey(full_name, avatar_url)",
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const plansByCoach = new Map<string, Plan[]>();
  for (const p of (plans ?? []) as unknown as Plan[]) {
    const list = plansByCoach.get(p.coach_id) ?? [];
    list.push(p);
    plansByCoach.set(p.coach_id, list);
  }

  const { checkout } = await searchParams;

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12 sm:py-20">
      <div className="mx-auto max-w-4xl space-y-10">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Choose your coaching plan
          </h1>
          <p className="text-sm text-slate-500">
            Pick a plan to get started. You can cancel anytime from your
            settings.
          </p>
        </div>

        {checkout === "canceled" && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Checkout was canceled. No charge was made — pick a plan to try
            again.
          </div>
        )}

        {plansByCoach.size === 0 && (
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

        {Array.from(plansByCoach.entries()).map(([coachId, coachPlans]) => {
          const coach = coachPlans[0].coach;
          return (
            <section key={coachId} className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {coach?.full_name ?? "Coach"}
                </h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {coachPlans.map((plan) => (
                  <Card key={plan.id} className="flex flex-col">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-base">
                          {plan.name}
                        </CardTitle>
                        <Badge variant="secondary">
                          {formatPrice(
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
                        <ul className="space-y-2 text-sm text-slate-600">
                          {plan.features.map((feature, i) => (
                            <li
                              key={i}
                              className="flex items-start gap-2"
                            >
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
          );
        })}
      </div>
    </div>
  );
}
