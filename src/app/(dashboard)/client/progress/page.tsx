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

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h2 className="text-lg font-semibold text-slate-900">
          Failed to load progress
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Something went wrong. Please try again later.
        </p>
      </div>
    );
  }

  const allCheckIns = checkIns ?? [];

  // Prepare weight chart data
  const weightData = allCheckIns
    .filter((ci) => ci.weight != null)
    .map((ci) => ({
      date: ci.week_of,
      weight: ci.weight as number,
    }));

  // Summary stats
  const startingWeight = weightData.length > 0 ? weightData[0].weight : null;
  const currentWeight =
    weightData.length > 0 ? weightData[weightData.length - 1].weight : null;
  const weightChange =
    startingWeight != null && currentWeight != null
      ? currentWeight - startingWeight
      : null;

  return (
    <div className="mx-auto max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Your Progress
        </h1>
        <p className="mt-1 text-sm text-slate-500">
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

      {/* Photo Timeline */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Photo Timeline</h2>
        <p className="mt-1 text-sm text-slate-500">
          Progress photos grouped by check-in date.
        </p>

        {allCheckIns.length === 0 ? (
          <div className="mt-6 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-16">
            <p className="text-sm text-slate-500">No check-ins yet.</p>
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
                        <span className="text-sm text-slate-500">
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
                            className="overflow-hidden rounded-lg bg-slate-100"
                          >
                            <img
                              src={photo.photo_url}
                              alt={photo.pose_type}
                              className="aspect-[3/4] w-full object-cover"
                            />
                            <p className="py-1 text-center text-xs capitalize text-slate-500">
                              {photo.pose_type}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400">
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
