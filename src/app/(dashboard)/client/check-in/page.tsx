"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PhotoUpload } from "@/components/check-ins/photo-upload";
import { MessageSquare, ChevronDown, ChevronUp, Camera } from "lucide-react";

interface PreviousCheckIn {
  id: string;
  weight_lbs: number | null;
  measurements: Record<string, number> | null;
  energy_level: number | null;
  adherence_rating: number | null;
  notes: string | null;
  week_of: string;
}

const ENERGY_LEVELS = [1, 2, 3, 4, 5] as const;
const ADHERENCE_LEVELS = [1, 2, 3, 4, 5] as const;

export default function CheckInPage() {
  const router = useRouter();
  const supabase = createClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previous, setPrevious] = useState<PreviousCheckIn | null>(null);
  const [history, setHistory] = useState<
    {
      id: string;
      week_of: string;
      weight_lbs: number | null;
      energy_level: number | null;
      adherence_rating: number | null;
      notes: string | null;
      coach_feedback: { body: string; created_at: string }[] | null;
    }[]
  >([]);

  // Form state
  const [weight, setWeight] = useState("");
  const [waist, setWaist] = useState("");
  const [chest, setChest] = useState("");
  const [hips, setHips] = useState("");
  const [arms, setArms] = useState("");
  const [energyLevel, setEnergyLevel] = useState<number | null>(null);
  const [adherenceRating, setAdherenceRating] = useState<number | null>(null);
  const [notes, setNotes] = useState("");

  // Photo URLs
  const [photoFront, setPhotoFront] = useState<string | null>(null);
  const [photoSide, setPhotoSide] = useState<string | null>(null);
  const [photoBack, setPhotoBack] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setUserId(user.id);

      // Fetch previous check-in
      const { data } = await supabase
        .from("check_ins")
        .select("id, weight_lbs, measurements, energy_level, adherence_rating, notes, week_of")
        .eq("client_id", user.id)
        .order("week_of", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setPrevious(data);
      }

      // Fetch check-in history with coach feedback
      const { data: historyData } = await supabase
        .from("check_ins")
        .select("id, week_of, weight_lbs, energy_level, adherence_rating, notes, coach_feedback(body, created_at)")
        .eq("client_id", user.id)
        .order("week_of", { ascending: false })
        .limit(10);

      if (historyData) {
        setHistory(historyData as typeof history);
      }

      setLoading(false);
    }

    init();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;

    setSubmitting(true);
    setError(null);

    try {
      const measurements: Record<string, number> = {};
      if (waist) measurements.waist = parseFloat(waist);
      if (chest) measurements.chest = parseFloat(chest);
      if (hips) measurements.hips = parseFloat(hips);
      if (arms) measurements.arms = parseFloat(arms);

      const weekOf = new Date().toISOString().split("T")[0];

      const { data: checkIn, error: insertError } = await supabase
        .from("check_ins")
        .insert({
          client_id: userId,
          weight_lbs: weight ? parseFloat(weight) : null,
          measurements: Object.keys(measurements).length > 0 ? measurements : null,
          energy_level: energyLevel,
          adherence_rating: adherenceRating,
          notes: notes || null,
          week_of: weekOf,
        })
        .select("id")
        .single();

      if (insertError) throw insertError;

      // Insert photo records
      const photos: { check_in_id: string; photo_url: string; pose_type: string }[] = [];

      if (photoFront) {
        photos.push({ check_in_id: checkIn.id, photo_url: photoFront, pose_type: "front" });
      }
      if (photoSide) {
        photos.push({ check_in_id: checkIn.id, photo_url: photoSide, pose_type: "side" });
      }
      if (photoBack) {
        photos.push({ check_in_id: checkIn.id, photo_url: photoBack, pose_type: "back" });
      }

      if (photos.length > 0) {
        const { error: photoError } = await supabase
          .from("check_in_photos")
          .insert(photos);

        if (photoError) throw photoError;
      }

      setSuccess(true);
    } catch (err) {
      console.error("Check-in submission failed:", err);
      setError("Failed to submit check-in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-foreground" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <CardTitle className="text-xl">Check-in Submitted</CardTitle>
            <CardDescription>
              Your weekly check-in has been recorded. Your coach will review it shortly.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center gap-3">
            <Button onClick={() => router.push("/client/progress")} variant="outline">
              View Progress
            </Button>
            <Button onClick={() => router.push("/client")}>Back to Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Weekly Check-in
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Record your progress for this week.
        </p>
      </div>

      {/* Previous check-in reference */}
      {previous && (
        <Card className="mt-6 bg-background">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Previous Check-in ({previous.week_of})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {previous.weight_lbs && (
                <div>
                  <span className="text-muted-foreground">Weight:</span>{" "}
                  <span className="font-medium">{previous.weight_lbs} lbs</span>
                </div>
              )}
              {previous.energy_level && (
                <div>
                  <span className="text-muted-foreground">Energy:</span>{" "}
                  <span className="font-medium">{previous.energy_level}/5</span>
                </div>
              )}
              {previous.adherence_rating && (
                <div>
                  <span className="text-muted-foreground">Adherence:</span>{" "}
                  <span className="font-medium">{previous.adherence_rating}/5</span>
                </div>
              )}
              {previous.measurements && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Measurements:</span>{" "}
                  <span className="font-medium">
                    {Object.entries(previous.measurements)
                      .map(([k, v]) => `${k}: ${v}"`)
                      .join(", ")}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-8">
        {/* Weight */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Weight</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-w-xs">
              <Label htmlFor="weight">Current Weight (lbs)</Label>
              <Input
                id="weight"
                type="number"
                step="0.1"
                placeholder="e.g. 175.5"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>

        {/* Measurements */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Measurements (inches)</CardTitle>
            <CardDescription>Optional: enter any measurements you have.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="waist">Waist</Label>
                <Input
                  id="waist"
                  type="number"
                  step="0.1"
                  placeholder="e.g. 32"
                  value={waist}
                  onChange={(e) => setWaist(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="chest">Chest</Label>
                <Input
                  id="chest"
                  type="number"
                  step="0.1"
                  placeholder="e.g. 40"
                  value={chest}
                  onChange={(e) => setChest(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="hips">Hips</Label>
                <Input
                  id="hips"
                  type="number"
                  step="0.1"
                  placeholder="e.g. 38"
                  value={hips}
                  onChange={(e) => setHips(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="arms">Arms</Label>
                <Input
                  id="arms"
                  type="number"
                  step="0.1"
                  placeholder="e.g. 14"
                  value={arms}
                  onChange={(e) => setArms(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Energy Level */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Energy Level</CardTitle>
            <CardDescription>How was your energy this week?</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              {ENERGY_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setEnergyLevel(level)}
                  className={`flex h-10 w-10 items-center justify-center rounded-lg border text-sm font-medium transition-colors ${
                    energyLevel === level
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-border bg-card text-foreground hover:border-primary"
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>Very Low</span>
              <span>Very High</span>
            </div>
          </CardContent>
        </Card>

        {/* Adherence Rating */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Plan Adherence</CardTitle>
            <CardDescription>How well did you stick to your plan?</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              {ADHERENCE_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setAdherenceRating(level)}
                  className={`flex h-10 w-10 items-center justify-center rounded-lg border text-sm font-medium transition-colors ${
                    adherenceRating === level
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-border bg-card text-foreground hover:border-primary"
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>Not at all</span>
              <span>Perfectly</span>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
            <CardDescription>Anything else you want your coach to know?</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="How did your week go? Any challenges, wins, or changes?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>

        {/* Photos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Camera className="h-4 w-4" />
              Progress Photos
            </CardTitle>
            <CardDescription>Upload 3 photos to track visual progress.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Photo tips */}
            <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground space-y-2">
              <p className="font-medium text-foreground">How to take good progress photos:</p>
              <div className="space-y-1">
                <p>&bull; Same spot, same lighting, same time of day (morning is best)</p>
                <p>&bull; Wear minimal, form-fitting clothes (shorts/sports bra or shirtless)</p>
                <p>&bull; Stand relaxed, arms at your sides &mdash; don&apos;t flex or pose</p>
                <p>&bull; Use a timer or mirror &mdash; keep the phone at chest height</p>
                <p>&bull; <span className="font-medium text-foreground">Front:</span> face the camera straight on, feet shoulder-width apart</p>
                <p>&bull; <span className="font-medium text-foreground">Side:</span> turn 90&deg; to your right, arms relaxed</p>
                <p>&bull; <span className="font-medium text-foreground">Back:</span> face away from the camera, same relaxed stance</p>
              </div>
            </div>

            {userId && (
              <div className="flex justify-center gap-6">
                <PhotoUpload
                  poseType="front"
                  userId={userId}
                  onUpload={(url) => setPhotoFront(url)}
                />
                <PhotoUpload
                  poseType="side"
                  userId={userId}
                  onUpload={(url) => setPhotoSide(url)}
                />
                <PhotoUpload
                  poseType="back"
                  userId={userId}
                  onUpload={(url) => setPhotoBack(url)}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Separator />

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pb-8">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/client")}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Submitting..." : "Submit Check-in"}
          </Button>
        </div>
      </form>

      {/* Check-in History with Coach Feedback */}
      {history.length > 0 && (
        <>
          <Separator className="my-8" />
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Past Check-ins
            </h2>
            <div className="space-y-3">
              {history.map((entry) => {
                const feedback = Array.isArray(entry.coach_feedback)
                  ? entry.coach_feedback[0]
                  : null;
                return (
                  <Card key={entry.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">
                          Week of {entry.week_of}
                        </CardTitle>
                        <div className="flex gap-3 text-xs text-muted-foreground">
                          {entry.weight_lbs != null && <span>{entry.weight_lbs} lbs</span>}
                          {entry.energy_level != null && <span>Energy: {entry.energy_level}/5</span>}
                          {entry.adherence_rating != null && <span>Adherence: {entry.adherence_rating}/5</span>}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {entry.notes && (
                        <p className="text-sm text-muted-foreground">{entry.notes}</p>
                      )}
                      {feedback ? (
                        <div className="rounded-lg bg-blue-50 p-3 mt-2">
                          <div className="flex items-center gap-1.5 mb-1">
                            <MessageSquare className="h-3.5 w-3.5 text-blue-600" />
                            <span className="text-xs font-medium text-blue-600">
                              Coach Feedback
                            </span>
                          </div>
                          <p className="text-sm text-foreground">{feedback.body}</p>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">
                          Awaiting coach review
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
