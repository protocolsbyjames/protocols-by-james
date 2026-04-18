import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { WeightChart } from "@/components/progress/weight-chart";
import { StrengthChart } from "@/components/progress/strength-chart";

export default async function ClientProgressPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch all check-ins with photos ordered by week_of
  const { data: checkIns, error } = await supabase
    .from("check_ins")
    .select("*, check_in_photos(*)")
    .eq("client_id", user.id)
    .order("week_of", { ascending: true });

  // Fetch workout logs for strength tracking
  const { data: workoutLogs } = await supabase
    .from("workout_logs")
    .select("workout_date, weight_lbs, reps_completed, exercise_id")
    .eq("client_id", user.id)
    .order("workout_date", { ascending: true });

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h2 className="text-lg font-semibold text-foreground">
          Failed to load progress
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Something went wrong. Please try again later.
        </p>
      </div>
    );
  }

  const allCheckIns = checkIns ?? [];
  const allLogs = workoutLogs ?? [];

  // Prepare weight chart data
  const weightData = allCheckIns
    .filter((ci) => ci.weight != null)
    .map((ci) => ({
      date: ci.week_of,
      weight: ci.weight as number,
    }));

  // Prepare strength volume data — aggregate by date
  const volumeByDate: Record<string, { volume: number; sets: number }> = {};
  for (const log of allLogs) {
    const date = log.workout_date;
    if (!volumeByDate[date]) {
      volumeByDate[date] = { volume: 0, sets: 0 };
    }
    const weight = log.weight_lbs ?? 0;
    const reps = log.reps_completed ?? 0;
    volumeByDate[date].volume += weight * reps;
    volumeByDate[date].sets += 1;
  }

  const volumeData = Object.entries(volumeByDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({
      date,
      volume: Math.round(data.volume),
      sets: data.sets,
    }));

  // Summary stats
  const startingWeight = weightData.length > 0 ? weightData[0].weight : null;
  const currentWeight =
    weightData.length > 0 ? weightData[weightData.length - 1].weight : null;
  const weightChange =
    startingWeight != null && currentWeight != null
      ? currentWeight - startingWeight
      : null;

  // Strength stats
  const totalWorkouts = Object.keys(volumeByDate).length;
  const totalSets = allLogs.length;
  const totalVolume = volumeData.reduce((sum, d) => sum + d.volume, 0);

  return (
    <div className="mx-auto max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Your Progress
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track your journey over time.
        </p>
      </div>

      {/* Summary Stats */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Starting Weight</CardDescription>
            <CardTitle className="text-2xl">
              {startingWeight != null ? `${startingWeight} lbs` : "N/A"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Current Weight</CardDescription>
            <CardTitle className="text-2xl">
              {currentWeight != null ? `${currentWeight} lbs` : "N/A"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Change</CardDescription>
            <CardTitle
              className={`text-2xl ${
                weightChange != null
                  ? weightChange < 0
                    ? "text-green-600"
                    : weightChange > 0
                      ? "text-red-600"
                      : ""
                  : ""
              }`}
            >
              {weightChange != null
                ? `${weightChange > 0 ? "+" : ""}${weightChange.toFixed(1)} lbs`
                : "N/A"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Weight Chart */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-base">Weight Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <WeightChart data={weightData} />
        </CardContent>
      </Card>

      <Separator className="my-8" />

      {/* Strength Stats */}
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Strength & Volume
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Training volume tracked from your workout logs.
        </p>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Workouts Logged</CardDescription>
            <CardTitle className="text-2xl">{totalWorkouts}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Sets</CardDescription>
            <CardTitle className="text-2xl">{totalSets.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Volume</CardDescription>
            <CardTitle className="text-2xl">
              {totalVolume > 0
                ? `${totalVolume.toLocaleString()} lbs`
                : "N/A"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Volume Per Session</CardTitle>
          <CardDescription>
            Total weight x reps each day you trained.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StrengthChart data={volumeData} />
        </CardContent>
      </Card>

      <Separator className="my-8" />

      {/* Photo Timeline */}
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Photo Timeline
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Progress photos grouped by check-in date.
        </p>

        {allCheckIns.length === 0 ? (
          <div className="mt-6 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-16">
            <p className="text-sm text-muted-foreground">No check-ins yet.</p>
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {[...allCheckIns].reverse().map((ci) => {
              const photos = ci.check_in_photos as
                | { id: string; photo_url: string; pose_type: string }[]
                | null;

              return (
                <Card key={ci.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">
                        {ci.week_of}
                      </CardTitle>
                      {ci.weight != null && (
                        <span className="text-sm text-muted-foreground">
                          {ci.weight} lbs
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {photos && photos.length > 0 ? (
                      <div className="grid grid-cols-3 gap-3">
                        {photos.map((photo) => (
                          <div
                            key={photo.id}
                            className="overflow-hidden rounded-lg bg-muted"
                          >
                            <img
                              src={photo.photo_url}
                              alt={photo.pose_type}
                              className="aspect-[3/4] w-full object-cover"
                            />
                            <p className="py-1 text-center text-xs capitalize text-muted-foreground">
                              {photo.pose_type}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No photos for this check-in.
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
