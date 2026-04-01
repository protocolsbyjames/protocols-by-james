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
import { CoachFeedbackForm } from "./feedback-form";

export default async function CoachCheckInDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch the check-in with photos
  const { data: checkIn, error } = await supabase
    .from("check_ins")
    .select("*, check_in_photos(*)")
    .eq("id", id)
    .single();

  if (error || !checkIn) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h2 className="text-lg font-semibold text-slate-900">Check-in not found</h2>
        <p className="mt-1 text-sm text-slate-500">
          This check-in may have been deleted or you do not have access.
        </p>
      </div>
    );
  }

  // Fetch client profile
  const { data: clientProfile } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .eq("id", checkIn.client_id)
    .single();

  // Fetch the previous check-in for comparison
  const { data: previousCheckIn } = await supabase
    .from("check_ins")
    .select("*, check_in_photos(*)")
    .eq("client_id", checkIn.client_id)
    .lt("week_of", checkIn.week_of)
    .order("week_of", { ascending: false })
    .limit(1)
    .single();

  const measurements = checkIn.measurements as Record<string, number> | null;
  const prevMeasurements = previousCheckIn?.measurements as Record<string, number> | null;

  return (
    <div className="mx-auto max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Check-in Review
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {clientProfile?.full_name ?? "Client"} &mdash; Week of{" "}
          {checkIn.week_of}
        </p>
      </div>

      {/* Side-by-side weight comparison */}
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {/* Current check-in */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Current ({checkIn.week_of})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {checkIn.weight != null && (
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-slate-500">Weight</span>
                <span className="text-lg font-semibold">{checkIn.weight} lbs</span>
              </div>
            )}
            {measurements && Object.keys(measurements).length > 0 && (
              <div>
                <span className="text-sm text-slate-500">Measurements</span>
                <div className="mt-1 grid grid-cols-2 gap-1 text-sm">
                  {Object.entries(measurements).map(([key, val]) => (
                    <div key={key} className="flex justify-between">
                      <span className="capitalize text-slate-600">{key}</span>
                      <span className="font-medium">{val}&quot;</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Current photos */}
            {checkIn.check_in_photos && checkIn.check_in_photos.length > 0 && (
              <div>
                <span className="text-sm text-slate-500">Photos</span>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {checkIn.check_in_photos.map(
                    (photo: { id: string; photo_url: string; pose_type: string }) => (
                      <div key={photo.id} className="overflow-hidden rounded-lg">
                        <img
                          src={photo.photo_url}
                          alt={photo.pose_type}
                          className="aspect-[3/4] w-full object-cover"
                        />
                        <p className="mt-1 text-center text-xs capitalize text-slate-500">
                          {photo.pose_type}
                        </p>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Previous check-in */}
        <Card className="bg-slate-50">
          <CardHeader>
            <CardTitle className="text-base text-slate-600">
              {previousCheckIn
                ? `Previous (${previousCheckIn.week_of})`
                : "Previous"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {previousCheckIn ? (
              <>
                {previousCheckIn.weight != null && (
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-slate-500">Weight</span>
                    <div className="text-right">
                      <span className="text-lg font-semibold text-slate-600">
                        {previousCheckIn.weight} lbs
                      </span>
                      {checkIn.weight != null && (
                        <span
                          className={`ml-2 text-sm font-medium ${
                            checkIn.weight < previousCheckIn.weight
                              ? "text-green-600"
                              : checkIn.weight > previousCheckIn.weight
                                ? "text-red-600"
                                : "text-slate-400"
                          }`}
                        >
                          {checkIn.weight < previousCheckIn.weight
                            ? `${(previousCheckIn.weight - checkIn.weight).toFixed(1)} lbs`
                            : checkIn.weight > previousCheckIn.weight
                              ? `+${(checkIn.weight - previousCheckIn.weight).toFixed(1)} lbs`
                              : "No change"}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {prevMeasurements && Object.keys(prevMeasurements).length > 0 && (
                  <div>
                    <span className="text-sm text-slate-500">Measurements</span>
                    <div className="mt-1 grid grid-cols-2 gap-1 text-sm">
                      {Object.entries(prevMeasurements).map(([key, val]) => (
                        <div key={key} className="flex justify-between">
                          <span className="capitalize text-slate-600">{key}</span>
                          <span className="font-medium text-slate-600">{val}&quot;</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Previous photos */}
                {previousCheckIn.check_in_photos &&
                  previousCheckIn.check_in_photos.length > 0 && (
                    <div>
                      <span className="text-sm text-slate-500">Photos</span>
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        {previousCheckIn.check_in_photos.map(
                          (photo: { id: string; photo_url: string; pose_type: string }) => (
                            <div key={photo.id} className="overflow-hidden rounded-lg">
                              <img
                                src={photo.photo_url}
                                alt={photo.pose_type}
                                className="aspect-[3/4] w-full object-cover"
                              />
                              <p className="mt-1 text-center text-xs capitalize text-slate-500">
                                {photo.pose_type}
                              </p>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}
              </>
            ) : (
              <p className="text-sm text-slate-400">No previous check-in available.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed metrics */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <span className="text-sm text-slate-500">Energy Level</span>
              <p className="text-lg font-semibold">
                {checkIn.energy_level != null ? `${checkIn.energy_level}/5` : "N/A"}
              </p>
            </div>
            <div>
              <span className="text-sm text-slate-500">Adherence</span>
              <p className="text-lg font-semibold">
                {checkIn.adherence_rating != null
                  ? `${checkIn.adherence_rating}/5`
                  : "N/A"}
              </p>
            </div>
          </div>

          {checkIn.notes && (
            <div>
              <span className="text-sm text-slate-500">Client Notes</span>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                {checkIn.notes}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Separator className="my-8" />

      {/* Coach feedback section */}
      <div className="pb-8">
        <CoachFeedbackForm
          checkInId={checkIn.id}
          existingFeedback={checkIn.coach_feedback ?? null}
        />
      </div>
    </div>
  );
}
