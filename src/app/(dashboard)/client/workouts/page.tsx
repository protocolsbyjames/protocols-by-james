import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dumbbell } from "lucide-react";
import { ExerciseList } from "./exercise-list";

export default async function ClientWorkoutsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: plan } = await supabase
    .from("workout_plans")
    .select(
      "id, name, description, weeks, days_per_week, workout_days(id, day_number, name, exercises(id, name, sets, reps, rest_seconds, notes, sort_order))"
    )
    .eq("client_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!plan) {
    return (
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          My Workouts
        </h1>
        <div className="mt-12 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-16">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <Dumbbell className="h-7 w-7 text-muted-foreground" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-foreground">
            No workout plan assigned
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your coach hasn&apos;t assigned a workout plan yet.
          </p>
        </div>
      </div>
    );
  }

  // Fetch existing completions for this user
  const { data: completions } = await supabase
    .from("exercise_completions")
    .select("exercise_id, completed_at")
    .eq("client_id", user.id);

  const completedIds = new Set((completions ?? []).map((c) => c.exercise_id));

  const sortedDays = [...(plan.workout_days ?? [])].sort(
    (a, b) => a.day_number - b.day_number
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          My Workouts
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{plan.name}</p>
        {plan.description && (
          <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>
        )}
        <div className="mt-3 flex gap-3">
          {plan.weeks != null && (
            <Badge variant="secondary">{plan.weeks} weeks</Badge>
          )}
          {plan.days_per_week != null && (
            <Badge variant="secondary">{plan.days_per_week} days/week</Badge>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {sortedDays.map((day) => {
          const exercises = [...(day.exercises ?? [])].sort(
            (a, b) => a.sort_order - b.sort_order
          );

          return (
            <Card key={day.id}>
              <CardHeader>
                <CardTitle className="text-base">
                  {day.name || `Day ${day.day_number}`}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {exercises.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No exercises for this day.
                  </p>
                ) : (
                  <ExerciseList
                    exercises={exercises.map((ex) => ({
                      id: ex.id,
                      name: ex.name,
                      sets: ex.sets,
                      reps: ex.reps,
                      rest_seconds: ex.rest_seconds,
                      notes: ex.notes,
                    }))}
                    completedIds={Array.from(completedIds)}
                    userId={user.id}
                  />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
