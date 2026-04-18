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
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import {
  Dumbbell,
  UtensilsCrossed,
  ClipboardCheck,
  MessageSquare,
  Camera,
  ArrowLeft,
  CheckCircle2,
  Circle,
  Calendar,
  Notebook,
} from "lucide-react";

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function CoachClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: clientId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Verify this client belongs to the coach
  const { data: clientProfile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url, created_at")
    .eq("id", clientId)
    .eq("coach_id", user.id)
    .maybeSingle();

  if (profileError || !clientProfile) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h2 className="text-lg font-semibold text-foreground">
          Client not found
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This client may not exist or is not assigned to you.
        </p>
        <Link
          href="/coach"
          className={cn(buttonVariants({ variant: "outline" }), "mt-4")}
        >
          Back to Dashboard
        </Link>
      </div>
    );
  }

  // Fetch subscription status
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("status, price_cents, current_period_end")
    .eq("client_id", clientId)
    .eq("coach_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Fetch active workout plan with exercises and completions
  const { data: workoutPlan } = await supabase
    .from("workout_plans")
    .select(
      "id, name, weeks, days_per_week, workout_days(id, day_number, name, exercises(id, name, sets, reps, exercise_completions(id, completed_at)))"
    )
    .eq("client_id", clientId)
    .eq("coach_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Fetch active meal plan with meals
  const { data: mealPlan } = await supabase
    .from("meal_plans")
    .select("id, name, meals(id, meal_type, name, calories, protein_g, carbs_g, fat_g, sort_order)")
    .eq("client_id", clientId)
    .eq("coach_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Fetch recent workout logs (last 14 days)
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const { data: workoutLogs } = await supabase
    .from("workout_logs")
    .select("id, exercise_id, workout_date, set_number, weight_lbs, reps_completed, notes")
    .eq("client_id", clientId)
    .gte("workout_date", fourteenDaysAgo.toISOString().split("T")[0])
    .order("workout_date", { ascending: false })
    .order("set_number", { ascending: true });

  // Fetch recent meal logs (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const { data: mealLogs } = await supabase
    .from("meal_logs")
    .select("id, log_date, meal_type, description, calories, protein_g, carbs_g, fat_g")
    .eq("client_id", clientId)
    .gte("log_date", sevenDaysAgo.toISOString().split("T")[0])
    .order("log_date", { ascending: false })
    .order("created_at", { ascending: true });

  // Fetch recent check-ins with photos and feedback
  const { data: checkIns } = await supabase
    .from("check_ins")
    .select(
      "id, week_of, weight_lbs, energy_level, adherence_rating, notes, created_at, check_in_photos(id, photo_url, pose_type), coach_feedback(id, body, created_at)"
    )
    .eq("client_id", clientId)
    .order("week_of", { ascending: false })
    .limit(10);

  const checkInList = checkIns ?? [];

  // Compute workout completion stats
  const workoutDays = workoutPlan?.workout_days ?? [];
  const sortedDays = [...workoutDays].sort(
    (a, b) => a.day_number - b.day_number
  );
  let totalExercises = 0;
  let completedExercises = 0;
  for (const day of workoutDays) {
    for (const ex of day.exercises ?? []) {
      totalExercises++;
      if (
        (ex.exercise_completions as { id: string }[] | null)?.length
      ) {
        completedExercises++;
      }
    }
  }

  // Organize meals by type
  const meals = mealPlan?.meals ?? [];
  const sortedMeals = [...meals].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );
  const mealsByType: Record<string, typeof sortedMeals> = {};
  for (const meal of sortedMeals) {
    const type = meal.meal_type ?? "other";
    if (!mealsByType[type]) mealsByType[type] = [];
    mealsByType[type].push(meal);
  }

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link
          href="/coach"
          className="mt-1 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-muted-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <Avatar className="h-14 w-14">
          <AvatarImage
            src={clientProfile.avatar_url ?? undefined}
            alt={clientProfile.full_name ?? "Client"}
          />
          <AvatarFallback className="bg-muted text-lg font-medium text-muted-foreground">
            {getInitials(clientProfile.full_name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {clientProfile.full_name}
          </h1>
          <p className="text-sm text-muted-foreground">{clientProfile.email}</p>
          <div className="mt-2 flex items-center gap-2">
            <Badge
              variant={
                subscription?.status === "active" ? "default" : "secondary"
              }
            >
              {subscription?.status ?? "No subscription"}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Client since {formatDate(clientProfile.created_at)}
            </span>
          </div>
        </div>
      </div>

      <Separator className="my-8" />

      {/* Workout Completions */}
      <section>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Dumbbell className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-foreground">
              Workout Plan
            </h2>
          </div>
          <Link
            href={
              workoutPlan
                ? `/coach/workouts/${workoutPlan.id}`
                : `/coach/workouts/new?client=${clientId}`
            }
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
            )}
          >
            {workoutPlan ? "Edit plan" : "Assign plan"}
          </Link>
        </div>

        {workoutPlan ? (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">
                {workoutPlan.name}
              </p>
              <span className="text-sm text-muted-foreground">
                {completedExercises}/{totalExercises} exercises completed
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-blue-500 transition-all"
                style={{
                  width: `${totalExercises > 0 ? (completedExercises / totalExercises) * 100 : 0}%`,
                }}
              />
            </div>

            {/* Days breakdown */}
            <div className="grid gap-3 sm:grid-cols-2">
              {sortedDays.map((day) => {
                const dayExercises = day.exercises ?? [];
                return (
                  <Card key={day.id} className="border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">
                        {day.name || `Day ${day.day_number}`}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      {dayExercises.map((ex) => {
                        const done =
                          (
                            ex.exercise_completions as
                              | { id: string }[]
                              | null
                          )?.length ?? 0 > 0;
                        return (
                          <div
                            key={ex.id}
                            className="flex items-center gap-2 text-sm"
                          >
                            {done ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <Circle className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span
                              className={
                                done
                                  ? "text-muted-foreground line-through"
                                  : "text-foreground"
                              }
                            >
                              {ex.name}
                            </span>
                            <span className="ml-auto text-xs text-muted-foreground">
                              {ex.sets} x {ex.reps}
                            </span>
                          </div>
                        );
                      })}
                      {dayExercises.length === 0 && (
                        <p className="text-xs text-muted-foreground">No exercises</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            No workout plan assigned.
          </p>
        )}
      </section>

      {/* Recent Workout Logs */}
      {(workoutLogs ?? []).length > 0 && (() => {
        // Build exercise name lookup from workout plan
        const exerciseNames: Record<string, string> = {};
        for (const day of workoutDays) {
          for (const ex of day.exercises ?? []) {
            exerciseNames[ex.id] = ex.name;
          }
        }

        // Group logs by date, then by exercise
        const logsByDate: Record<string, Record<string, { name: string; sets: { set_number: number; weight_lbs: number; reps_completed: number }[] }>> = {};
        for (const log of workoutLogs ?? []) {
          const date = log.workout_date;
          if (!logsByDate[date]) logsByDate[date] = {};
          const exId = log.exercise_id;
          if (!logsByDate[date][exId]) {
            logsByDate[date][exId] = {
              name: exerciseNames[exId] ?? "Unknown exercise",
              sets: [],
            };
          }
          logsByDate[date][exId].sets.push({
            set_number: log.set_number,
            weight_lbs: Number(log.weight_lbs),
            reps_completed: log.reps_completed,
          });
        }

        const sortedDates = Object.keys(logsByDate).sort((a, b) => b.localeCompare(a));

        return (
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-3">
              <Notebook className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">Recent Training Logs (14 days)</p>
            </div>
            <div className="space-y-3">
              {sortedDates.map((date) => (
                <Card key={date} className="border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="h-3 w-3" />
                      {new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {Object.values(logsByDate[date]).map((exercise, i) => (
                      <div key={i}>
                        <p className="text-sm font-medium text-foreground">{exercise.name}</p>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {exercise.sets.sort((a, b) => a.set_number - b.set_number).map((s) => (
                            <span key={s.set_number} className="text-xs text-muted-foreground bg-muted rounded px-2 py-0.5">
                              Set {s.set_number}: {s.weight_lbs} lbs &times; {s.reps_completed}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })()}

      <Separator className="my-8" />

      {/* Meal Plan */}
      <section>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="h-5 w-5 text-green-600" />
            <h2 className="text-lg font-semibold text-foreground">Meal Plan</h2>
          </div>
          <Link
            href={
              mealPlan
                ? `/coach/meals/${mealPlan.id}`
                : `/coach/meals/new?client=${clientId}`
            }
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
            )}
          >
            {mealPlan ? "Edit plan" : "Assign plan"}
          </Link>
        </div>

        {mealPlan ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm font-medium text-foreground">
              {mealPlan.name}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(mealsByType).map(([type, typeMeals]) => (
                <Card key={type} className="border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm capitalize">{type}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {typeMeals.map((meal) => (
                      <div key={meal.id}>
                        <p className="text-sm font-medium text-foreground">
                          {meal.name}
                        </p>
                        <div className="flex gap-3 text-xs text-muted-foreground">
                          {meal.calories != null && (
                            <span>{meal.calories} cal</span>
                          )}
                          {meal.protein_g != null && (
                            <span>{meal.protein_g}g P</span>
                          )}
                          {meal.carbs_g != null && (
                            <span>{meal.carbs_g}g C</span>
                          )}
                          {meal.fat_g != null && (
                            <span>{meal.fat_g}g F</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            No meal plan assigned.
          </p>
        )}
      {/* Recent Meal Logs */}
      {(mealLogs ?? []).length > 0 && (() => {
        const MEAL_TYPE_ORDER = ["breakfast", "pre_workout", "lunch", "post_workout", "dinner", "snack"];
        const mealTypeLabel = (t: string) =>
          t.replace("_", "-").replace(/\b\w/g, (c) => c.toUpperCase());

        // Group by date
        const logsByDate: Record<string, typeof mealLogs> = {};
        for (const log of mealLogs ?? []) {
          if (!logsByDate[log.log_date]) logsByDate[log.log_date] = [];
          logsByDate[log.log_date]!.push(log);
        }

        const sortedDates = Object.keys(logsByDate).sort((a, b) => b.localeCompare(a));

        return (
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-3">
              <Notebook className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">Recent Meal Logs (7 days)</p>
            </div>
            <div className="space-y-3">
              {sortedDates.map((date) => {
                const dayLogs = logsByDate[date] ?? [];
                const totalCal = dayLogs.reduce((s, m) => s + (m.calories ?? 0), 0);
                const totalP = dayLogs.reduce((s, m) => s + (m.protein_g ?? 0), 0);
                const totalC = dayLogs.reduce((s, m) => s + (m.carbs_g ?? 0), 0);
                const totalF = dayLogs.reduce((s, m) => s + (m.fat_g ?? 0), 0);

                // Group by meal type
                const grouped = MEAL_TYPE_ORDER
                  .map((type) => ({
                    type,
                    label: mealTypeLabel(type),
                    meals: dayLogs.filter((m) => m.meal_type === type),
                  }))
                  .filter((g) => g.meals.length > 0);

                return (
                  <Card key={date} className="border-border">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                          <Calendar className="h-3 w-3" />
                          {new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                        </CardTitle>
                        <span className="text-xs text-muted-foreground">
                          {totalCal} cal &middot; {totalP}g P &middot; {totalC}g C &middot; {totalF}g F
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {grouped.map((group) => (
                        <div key={group.type}>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{group.label}</p>
                          {group.meals.map((meal) => (
                            <div key={meal.id} className="text-sm text-foreground mt-0.5">
                              {meal.description}
                              {meal.calories != null && (
                                <span className="text-xs text-muted-foreground ml-2">
                                  {meal.calories} cal
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })()}
      </section>

      <Separator className="my-8" />

      {/* Check-ins, Progress Photos & Feedback History */}
      <section>
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-amber-600" />
          <h2 className="text-lg font-semibold text-foreground">
            Check-in History
          </h2>
        </div>

        {checkInList.length > 0 ? (
          <div className="mt-4 space-y-4">
            {checkInList.map((checkIn) => {
              const photos = checkIn.check_in_photos ?? [];
              const feedback = (
                checkIn.coach_feedback as
                  | { id: string; body: string; created_at: string }[]
                  | null
              )?.[0];

              return (
                <Card key={checkIn.id} className="border-border">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">
                        Week of {checkIn.week_of}
                      </CardTitle>
                      <Link
                        href={`/coach/check-ins/${checkIn.id}`}
                        className="text-xs font-medium text-blue-600 hover:underline"
                      >
                        Review
                      </Link>
                    </div>
                    <CardDescription className="flex gap-4 text-xs">
                      {checkIn.weight_lbs != null && (
                        <span>{checkIn.weight_lbs} lbs</span>
                      )}
                      {checkIn.energy_level != null && (
                        <span>Energy: {checkIn.energy_level}/5</span>
                      )}
                      {checkIn.adherence_rating != null && (
                        <span>Adherence: {checkIn.adherence_rating}/5</span>
                      )}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    {/* Client notes */}
                    {checkIn.notes && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">
                          Client Notes
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                          {checkIn.notes}
                        </p>
                      </div>
                    )}

                    {/* Progress Photos */}
                    {photos.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1">
                          <Camera className="h-3.5 w-3.5 text-muted-foreground" />
                          <p className="text-xs font-medium text-muted-foreground">
                            Progress Photos
                          </p>
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-2">
                          {(
                            photos as {
                              id: string;
                              photo_url: string;
                              pose_type: string;
                            }[]
                          ).map((photo) => (
                            <div
                              key={photo.id}
                              className="overflow-hidden rounded-lg"
                            >
                              <img
                                src={photo.photo_url}
                                alt={photo.pose_type}
                                className="aspect-[3/4] w-full object-cover"
                              />
                              <p className="mt-1 text-center text-xs capitalize text-muted-foreground">
                                {photo.pose_type}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Coach Feedback */}
                    {feedback ? (
                      <div className="rounded-lg bg-blue-50 p-3">
                        <div className="flex items-center gap-1">
                          <MessageSquare className="h-3.5 w-3.5 text-blue-600" />
                          <p className="text-xs font-medium text-blue-600">
                            Your Feedback
                          </p>
                        </div>
                        <p className="mt-1 text-sm text-foreground line-clamp-3">
                          {feedback.body}
                        </p>
                      </div>
                    ) : (
                      <Link
                        href={`/coach/check-ins/${checkIn.id}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 hover:underline"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        Add feedback
                      </Link>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            No check-ins submitted yet.
          </p>
        )}
      </section>
    </div>
  );
}
