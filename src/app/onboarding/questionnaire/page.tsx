import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { submitIntakeQuestionnaire } from "./actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Intake questionnaire · Protocols by James",
};

export const dynamic = "force-dynamic";

/**
 * /onboarding/questionnaire — the deep in-app intake.
 *
 * Flow gating:
 *   - Must be logged in.
 *   - profile.onboarding_status must be `agreement_signed` or later.
 *     Anything before that (applied / paid) should not see this page —
 *     they need to sign the agreement first.
 *   - If they already submitted (`questionnaire_done` / `active`), we
 *     bounce them to the waiting screen or the dashboard.
 *
 * Submitting runs the server action in actions.ts which upserts
 * client_intake_submissions and promotes the profile to
 * `questionnaire_done`, then redirects to /onboarding/waiting.
 */

export default async function QuestionnairePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
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

  // Gating: must have signed the agreement first.
  if (profile.onboarding_status === "applied" || profile.onboarding_status === "paid") {
    redirect("/onboarding/agreement");
  }
  if (
    profile.onboarding_status === "questionnaire_done" ||
    profile.onboarding_status === "active"
  ) {
    redirect("/onboarding/waiting");
  }

  // Try to reload any previous draft (the upsert path lets clients
  // re-submit, and we prefill from their last attempt on retry).
  const { data: existing } = await supabase
    .from("client_intake_submissions")
    .select(
      "height_cm, current_weight_kg, goal_weight_kg, training_experience, medical_clearance, clearance_doctor_name, answers",
    )
    .eq("profile_id", user.id)
    .maybeSingle();

  const priorAnswers = (existing?.answers ?? {}) as Record<string, unknown>;
  const err = (await searchParams).error;

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Tell me about you.
          </h1>
          <p className="text-sm text-slate-600 max-w-2xl">
            This is the deep intake. The more honest detail you give me here,
            the better the plan I can build for you. Everything is private and
            only visible to me. Takes about 10 minutes.
          </p>
        </div>

        {err && (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {err}
          </div>
        )}

        <form action={submitIntakeQuestionnaire} className="space-y-6">
          {/* Basics */}
          <Card>
            <CardHeader>
              <CardTitle>The basics</CardTitle>
              <CardDescription>
                Height, weight, and where you want to go.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="heightCm">Height (cm)</Label>
                <Input
                  id="heightCm"
                  name="heightCm"
                  type="number"
                  min={100}
                  max={260}
                  required
                  defaultValue={existing?.height_cm ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currentWeightKg">Current weight (kg)</Label>
                <Input
                  id="currentWeightKg"
                  name="currentWeightKg"
                  type="number"
                  step="0.1"
                  min={30}
                  max={300}
                  required
                  defaultValue={existing?.current_weight_kg ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="goalWeightKg">Goal weight (kg)</Label>
                <Input
                  id="goalWeightKg"
                  name="goalWeightKg"
                  type="number"
                  step="0.1"
                  min={30}
                  max={300}
                  defaultValue={existing?.goal_weight_kg ?? ""}
                />
              </div>
            </CardContent>
          </Card>

          {/* Experience */}
          <Card>
            <CardHeader>
              <CardTitle>Training experience</CardTitle>
              <CardDescription>
                How long you&apos;ve been training and at what level.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="trainingExperience">Experience level</Label>
                <select
                  id="trainingExperience"
                  name="trainingExperience"
                  required
                  defaultValue={existing?.training_experience ?? ""}
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="">— Select —</option>
                  <option value="beginner">Beginner (&lt;1 year)</option>
                  <option value="intermediate">
                    Intermediate (1–3 years)
                  </option>
                  <option value="advanced">Advanced (3+ years)</option>
                  <option value="competitor">Competitor</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="trainingHistory">Training history</Label>
                <Textarea
                  id="trainingHistory"
                  name="trainingHistory"
                  rows={4}
                  placeholder="What have you tried? What worked, what didn't?"
                  defaultValue={
                    (priorAnswers.training_history as string) ?? ""
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currentTraining">Current routine</Label>
                <Textarea
                  id="currentTraining"
                  name="currentTraining"
                  rows={4}
                  placeholder="What does your training look like right now?"
                  defaultValue={
                    (priorAnswers.current_training as string) ?? ""
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Medical */}
          <Card>
            <CardHeader>
              <CardTitle>Health & medical</CardTitle>
              <CardDescription>
                I need a clear picture of anything that could affect
                programming.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Cleared by your doctor for vigorous exercise?</Label>
                <div className="flex gap-4 pt-1">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="medicalClearance"
                      value="yes"
                      required
                      defaultChecked={existing?.medical_clearance === true}
                    />
                    Yes
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="medicalClearance"
                      value="no"
                      defaultChecked={existing?.medical_clearance === false}
                    />
                    No / not sure
                  </label>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="clearanceDoctorName">
                  Doctor / clinic name (optional)
                </Label>
                <Input
                  id="clearanceDoctorName"
                  name="clearanceDoctorName"
                  defaultValue={existing?.clearance_doctor_name ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="injuries">Injuries / limitations</Label>
                <Textarea
                  id="injuries"
                  name="injuries"
                  rows={3}
                  placeholder="Anything that hurts, anything you can't do"
                  defaultValue={(priorAnswers.injuries as string) ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="medications">Medications</Label>
                <Textarea
                  id="medications"
                  name="medications"
                  rows={3}
                  defaultValue={(priorAnswers.medications as string) ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplements">Supplements / peptides</Label>
                <Textarea
                  id="supplements"
                  name="supplements"
                  rows={3}
                  defaultValue={(priorAnswers.supplements as string) ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="allergies">Allergies / intolerances</Label>
                <Input
                  id="allergies"
                  name="allergies"
                  defaultValue={(priorAnswers.allergies as string) ?? ""}
                />
              </div>
            </CardContent>
          </Card>

          {/* Lifestyle */}
          <Card>
            <CardHeader>
              <CardTitle>Lifestyle & nutrition</CardTitle>
              <CardDescription>
                The stuff that happens outside the gym.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="sleepHours">Average sleep (hours/night)</Label>
                  <Input
                    id="sleepHours"
                    name="sleepHours"
                    type="number"
                    step="0.5"
                    min={0}
                    max={24}
                    defaultValue={
                      (priorAnswers.sleep_hours as number | string) ?? ""
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stressLevel">Stress level (1–10)</Label>
                  <Input
                    id="stressLevel"
                    name="stressLevel"
                    type="number"
                    min={1}
                    max={10}
                    defaultValue={
                      (priorAnswers.stress_level as number | string) ?? ""
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="typicalDayOfEating">
                  Typical day of eating
                </Label>
                <Textarea
                  id="typicalDayOfEating"
                  name="typicalDayOfEating"
                  rows={5}
                  placeholder="Walk me through what you eat on a normal day."
                  defaultValue={
                    (priorAnswers.typical_day_of_eating as string) ?? ""
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Goals + obstacles */}
          <Card>
            <CardHeader>
              <CardTitle>Goals & obstacles</CardTitle>
              <CardDescription>
                Where you want to go and what&apos;s getting in the way.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="primaryGoal">Primary goal</Label>
                <Textarea
                  id="primaryGoal"
                  name="primaryGoal"
                  rows={3}
                  placeholder="What does success look like for you in 6 months?"
                  defaultValue={(priorAnswers.primary_goal as string) ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="biggestObstacle">Biggest obstacle</Label>
                <Textarea
                  id="biggestObstacle"
                  name="biggestObstacle"
                  rows={3}
                  placeholder="What's been stopping you?"
                  defaultValue={
                    (priorAnswers.biggest_obstacle as string) ?? ""
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="anythingElse">Anything else I should know?</Label>
                <Textarea
                  id="anythingElse"
                  name="anythingElse"
                  rows={3}
                  defaultValue={(priorAnswers.anything_else as string) ?? ""}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-end gap-3">
            <Button type="submit" size="lg">
              Submit intake
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
