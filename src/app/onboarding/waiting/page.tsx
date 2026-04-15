import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { Check, Clock, MessageCircle } from "lucide-react";

export const metadata = {
  title: "Hang tight — Protocols by James",
};

export const dynamic = "force-dynamic";

/**
 * /onboarding/waiting — the "you're done, I'm working on it" state.
 *
 * Client lands here after submitting the intake questionnaire. They
 * stay here until James flips their status to `active` (which happens
 * when he finishes building their plan and assigns it).
 *
 * Gating:
 *   - Must be authenticated.
 *   - If status is `active`, bounce to dashboard — they shouldn't be
 *     stuck on a waiting screen once their plan is live.
 *   - If they haven't finished the questionnaire, send them back.
 */
export default async function WaitingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, onboarding_status")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) redirect("/login");
  if (profile.onboarding_status === "active") redirect("/client");
  if (
    profile.onboarding_status === "applied" ||
    profile.onboarding_status === "paid"
  ) {
    redirect("/onboarding/agreement");
  }
  if (profile.onboarding_status === "agreement_signed") {
    redirect("/onboarding/questionnaire");
  }

  const firstName = profile.full_name?.split(/\s+/)[0] ?? "there";

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-16">
      <div className="mx-auto max-w-2xl space-y-8">
        <div className="text-center space-y-3">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <Clock className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            All set, {firstName}.
          </h1>
          <p className="text-slate-600 max-w-md mx-auto">
            Your intake is in. I&apos;m reviewing everything personally and
            building out your custom plan.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>What happens next</CardTitle>
            <CardDescription>
              Here&apos;s exactly what to expect over the next few days.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4">
              <Step
                done
                title="You signed the agreement"
                body="Your signed copy is in your email."
              />
              <Step
                done
                title="You finished the intake questionnaire"
                body="I have everything I need to get started."
              />
              <Step
                title="I build your plan"
                body="Typically 2–3 business days. Training split, nutrition targets, and any protocol recommendations."
              />
              <Step
                title="Kick-off message"
                body="You'll get an email from me the moment your plan is live in the app."
              />
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>In the meantime</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <p>
              If you think of anything else you forgot to mention, or you want
              to change an answer, just reply to any of the emails from me —
              I&apos;ll make sure it gets into your plan.
            </p>
            <Link
              href="mailto:protocolsbyjames@gmail.com"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "mt-2",
              )}
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              Email James
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Step({
  title,
  body,
  done,
}: {
  title: string;
  body: string;
  done?: boolean;
}) {
  return (
    <li className="flex gap-3">
      <div
        className={cn(
          "mt-0.5 h-6 w-6 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold",
          done
            ? "bg-emerald-100 text-emerald-700"
            : "bg-slate-100 text-slate-500",
        )}
      >
        {done ? <Check className="h-3.5 w-3.5" /> : "·"}
      </div>
      <div className="flex-1">
        <div className="font-medium text-slate-900">{title}</div>
        <div className="text-sm text-slate-600">{body}</div>
      </div>
    </li>
  );
}
