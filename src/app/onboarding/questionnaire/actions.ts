"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/**
 * Server action that saves the in-app intake questionnaire.
 *
 * Runs as the authenticated client user (NOT service-role) — the RLS
 * policies in 00006_onboarding.sql allow a user to insert/update their
 * own row in client_intake_submissions. We also flip the profile's
 * onboarding_status to `questionnaire_done` so the coach portal can
 * surface this client as "waiting on me to build a plan".
 *
 * Schema is intentionally generous with optionals — the in-app flow has
 * to work even if a client skips a few questions. The required minimum
 * is height, weight, training experience, and medical clearance. The
 * rest lands in the jsonb `answers` column so we can add/remove
 * questions without migrations.
 */

// A few fields are promoted to real columns because we'll filter/sort
// by them in the coach portal. Everything else goes into `answers`.
const QuestionnaireSchema = z.object({
  heightCm: z.coerce.number().min(100).max(260),
  currentWeightKg: z.coerce.number().min(30).max(300),
  goalWeightKg: z.coerce.number().min(30).max(300).optional(),
  trainingExperience: z.enum([
    "beginner",
    "intermediate",
    "advanced",
    "competitor",
  ]),
  medicalClearance: z.enum(["yes", "no"]),
  clearanceDoctorName: z.string().trim().max(200).optional(),

  // Deeper context — all free-form, all optional, all stuffed into `answers`.
  primaryGoal: z.string().trim().max(1000).optional(),
  trainingHistory: z.string().trim().max(3000).optional(),
  currentTraining: z.string().trim().max(3000).optional(),
  injuries: z.string().trim().max(3000).optional(),
  medications: z.string().trim().max(3000).optional(),
  supplements: z.string().trim().max(3000).optional(),
  allergies: z.string().trim().max(1000).optional(),
  sleepHours: z.coerce.number().min(0).max(24).optional(),
  stressLevel: z.coerce.number().min(1).max(10).optional(),
  typicalDayOfEating: z.string().trim().max(5000).optional(),
  biggestObstacle: z.string().trim().max(3000).optional(),
  anythingElse: z.string().trim().max(5000).optional(),
});

function errorRedirect(msg: string): never {
  redirect("/onboarding/questionnaire?error=" + encodeURIComponent(msg));
}

export async function submitIntakeQuestionnaire(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = QuestionnaireSchema.safeParse({
    heightCm: formData.get("heightCm"),
    currentWeightKg: formData.get("currentWeightKg"),
    goalWeightKg: formData.get("goalWeightKg") || undefined,
    trainingExperience: formData.get("trainingExperience"),
    medicalClearance: formData.get("medicalClearance"),
    clearanceDoctorName: formData.get("clearanceDoctorName") || undefined,
    primaryGoal: formData.get("primaryGoal") || undefined,
    trainingHistory: formData.get("trainingHistory") || undefined,
    currentTraining: formData.get("currentTraining") || undefined,
    injuries: formData.get("injuries") || undefined,
    medications: formData.get("medications") || undefined,
    supplements: formData.get("supplements") || undefined,
    allergies: formData.get("allergies") || undefined,
    sleepHours: formData.get("sleepHours") || undefined,
    stressLevel: formData.get("stressLevel") || undefined,
    typicalDayOfEating: formData.get("typicalDayOfEating") || undefined,
    biggestObstacle: formData.get("biggestObstacle") || undefined,
    anythingElse: formData.get("anythingElse") || undefined,
  });

  if (!parsed.success) {
    errorRedirect(
      "Some required fields are missing. Double-check the form and try again.",
    );
  }

  const input = parsed.data;

  // Everything not promoted to columns goes here. Keys mirror the form
  // names so the coach portal can render them back easily.
  const answers = {
    primary_goal: input.primaryGoal ?? null,
    training_history: input.trainingHistory ?? null,
    current_training: input.currentTraining ?? null,
    injuries: input.injuries ?? null,
    medications: input.medications ?? null,
    supplements: input.supplements ?? null,
    allergies: input.allergies ?? null,
    sleep_hours: input.sleepHours ?? null,
    stress_level: input.stressLevel ?? null,
    typical_day_of_eating: input.typicalDayOfEating ?? null,
    biggest_obstacle: input.biggestObstacle ?? null,
    anything_else: input.anythingElse ?? null,
  };

  // Upsert so a client can re-submit if they hit an error mid-flow.
  const { error: upsertErr } = await supabase
    .from("client_intake_submissions")
    .upsert(
      {
        profile_id: user.id,
        height_cm: input.heightCm,
        current_weight_kg: input.currentWeightKg,
        goal_weight_kg: input.goalWeightKg ?? null,
        training_experience: input.trainingExperience,
        medical_clearance: input.medicalClearance === "yes",
        clearance_doctor_name: input.clearanceDoctorName ?? null,
        answers,
      },
      { onConflict: "profile_id" },
    );

  if (upsertErr) {
    console.error("Failed to save intake submission:", upsertErr);
    errorRedirect("Couldn't save your answers. Please try again.");
  }

  // Flip the profile flag so James sees this client in "ready for plan build".
  const { error: profileErr } = await supabase
    .from("profiles")
    .update({ onboarding_status: "questionnaire_done" })
    .eq("id", user.id);

  if (profileErr) {
    // Non-fatal: the questionnaire saved. James can manually flip status
    // from the coach portal if needed.
    console.error("Failed to bump onboarding_status:", profileErr);
  }

  redirect("/onboarding/waiting");
}
