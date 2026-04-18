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
import { Badge } from "@/components/ui/badge";
import {
  Dumbbell,
  UtensilsCrossed,
  Target,
  Clock,
  TrendingUp,
  AlertTriangle,
  Flame,
  Beef,
  Scale,
  Activity,
  HeartPulse,
} from "lucide-react";
import { HeartRateCalculator } from "./heart-rate-calculator";

export default async function ClientGuidePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Determine which program the client has
  const { data: plan } = await supabase
    .from("workout_plans")
    .select("name")
    .eq("client_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const planName = plan?.name?.toLowerCase() ?? "";
  const isShred = planName.includes("shred");
  const isSize = planName.includes("size");
  const isSelfGuided = isShred || isSize;

  // Fetch client's intake data for personalized targets
  const { data: intake } = await supabase
    .from("client_intake_submissions")
    .select("height_cm, current_weight_kg, goal_weight_kg")
    .eq("profile_id", user.id)
    .maybeSingle();

  const weightKg = intake?.current_weight_kg ?? null;
  const weightLbs = weightKg ? Math.round(weightKg * 2.205) : null;

  // Macro formula:
  // SIZE:  Calories = BW x 16, Protein = 1g/lb, Fats = 0.35g/lb, Carbs = fill
  // SHRED: Calories = BW x 12, Protein = 1g/lb, Fats = 0.3g/lb, Carbs = fill
  const proteinTarget = weightLbs ?? null;
  const calorieTarget = weightLbs
    ? isShred
      ? Math.round(weightLbs * 12)
      : Math.round(weightLbs * 16)
    : null;
  const fatTarget = weightLbs
    ? isShred
      ? Math.round(weightLbs * 0.3)
      : Math.round(weightLbs * 0.35)
    : null;
  // Carbs = (calories - protein*4 - fat*9) / 4
  const carbTarget =
    calorieTarget && proteinTarget && fatTarget
      ? Math.round((calorieTarget - proteinTarget * 4 - fatTarget * 9) / 4)
      : null;

  return (
    <div className="mx-auto max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Program Guide
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {plan?.name
            ? `Everything you need to know about ${plan.name}.`
            : "How to get the most out of your program."}
        </p>
      </div>

      {/* ── HOW TO FOLLOW THIS PROGRAM ── */}
      <Card className="mt-8">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-emerald-600" />
            <CardTitle>How to Follow This Program</CardTitle>
          </div>
          <CardDescription>
            Read this before your first session.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground leading-relaxed">
          <p>
            This program is designed to be followed exactly as written. Each
            training day has a specific purpose — don&apos;t rearrange exercises or
            skip days. Consistency beats perfection.
          </p>
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Dumbbell className="h-4 w-4 mt-0.5 text-foreground flex-shrink-0" />
              <div>
                <p className="font-medium text-foreground">Train the days in order</p>
                <p>
                  Day 1, Day 2, Day 3, etc. Take rest days when you need them,
                  but keep the sequence. Most people do well with a rest day
                  after every 2–3 training days.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="h-4 w-4 mt-0.5 text-foreground flex-shrink-0" />
              <div>
                <p className="font-medium text-foreground">Respect the rest periods</p>
                <p>
                  Rest times are programmed for a reason. Compound lifts
                  (squats, bench, deadlift) get 90–120 seconds. Isolation
                  exercises get 60–90 seconds. Time them — don&apos;t guess.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <TrendingUp className="h-4 w-4 mt-0.5 text-foreground flex-shrink-0" />
              <div>
                <p className="font-medium text-foreground">Progressive overload</p>
                <p>
                  Your goal each session is to beat your last performance — even
                  by one rep or 2.5 lbs. Log everything so you know what to
                  beat. If you hit the top of the rep range on all sets, go up
                  in weight next session.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 mt-0.5 text-foreground flex-shrink-0" />
              <div>
                <p className="font-medium text-foreground">If you plateau</p>
                <p>
                  Stuck for 2+ weeks on the same weight? Try these in order:
                  (1) add one more rep per set, (2) add a rest-pause on the
                  last set, (3) drop the weight 10% and build back up. Still
                  stuck after 3 weeks? Reach out.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── TRAINING INTENSITY ── */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-500" />
            <CardTitle>Training Intensity</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground leading-relaxed">
          <p>
            Every working set should be taken to within 1–2 reps of failure
            (RPE 8–9). That means if you&apos;re prescribed 10 reps and you could
            have done 15, the weight is too light. If you can&apos;t hit the bottom
            of the rep range, the weight is too heavy.
          </p>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg border border-border p-3">
              <p className="text-2xl font-bold text-foreground">RPE 7</p>
              <p className="text-xs mt-1">Warm-up sets — could do 3+ more reps</p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
              <p className="text-2xl font-bold text-emerald-700">RPE 8–9</p>
              <p className="text-xs mt-1">Working sets — 1–2 reps left in tank</p>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50/50 p-3">
              <p className="text-2xl font-bold text-red-600">RPE 10</p>
              <p className="text-xs mt-1">Failure — avoid except last set occasionally</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator className="my-8" />

      {/* ── NUTRITION GUIDANCE ── */}
      <div>
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <UtensilsCrossed className="h-5 w-5" />
          Nutrition Guidance
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {isShred
            ? "Simple nutrition principles for getting lean."
            : isSize
              ? "Simple nutrition principles for building size."
              : "Simple nutrition principles for your program."}
        </p>
      </div>

      {/* Personalized targets */}
      {weightLbs && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <Scale className="h-3.5 w-3.5" /> Calories
              </CardDescription>
              <CardTitle className="text-2xl">
                {calorieTarget?.toLocaleString()}<span className="text-sm font-normal text-muted-foreground">/day</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {isShred
                  ? "Deficit to lose fat. Adjust based on weekly weigh-ins."
                  : "Surplus to build muscle. Adjust based on weekly weigh-ins."}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <Beef className="h-3.5 w-3.5" /> Protein
              </CardDescription>
              <CardTitle className="text-2xl">
                {proteinTarget}g<span className="text-sm font-normal text-muted-foreground">/day</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                1g per lb bodyweight. Non-negotiable.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Fats</CardDescription>
              <CardTitle className="text-2xl">
                {fatTarget}g<span className="text-sm font-normal text-muted-foreground">/day</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {isShred ? "0.3g per lb." : "0.35g per lb."} Supports hormones and recovery.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Carbs</CardDescription>
              <CardTitle className="text-2xl">
                {carbTarget}g<span className="text-sm font-normal text-muted-foreground">/day</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Fills remaining calories. Fuels your training.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Water</CardDescription>
              <CardTitle className="text-2xl">
                1 gallon<span className="text-sm font-normal text-muted-foreground">/day</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Every day. Carry a jug.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Nutrition content — Size */}
      {(isSize || !isSelfGuided) && !isShred && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Eating for Size</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground leading-relaxed">
            <p>
              Building muscle requires a calorie surplus. Your target is set at
              bodyweight &times; 16. Hit your protein, keep fats at 0.35g per lb,
              and fill the rest with carbs from the approved foods list.
            </p>
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
              <p className="font-medium text-foreground">What matters most:</p>
              <ol className="list-decimal list-inside space-y-1.5 ml-1">
                <li><span className="font-medium text-foreground">Protein first.</span> Hit your target every day. Spread it across 4–5 meals.</li>
                <li><span className="font-medium text-foreground">Eat enough carbs.</span> Carbs fuel your training. Rice, oats, sweet potatoes — eat them.</li>
                <li><span className="font-medium text-foreground">Don&apos;t fear fats.</span> Keep fats at 0.35g per lb. They support hormones.</li>
                <li><span className="font-medium text-foreground">Eat around training.</span> Solid meal 1–2 hours before and after. Protein + carbs post-workout.</li>
                <li><span className="font-medium text-foreground">Weigh yourself weekly.</span> Aim for 0.5–1 lb/week gain. Not gaining? Eat 200 more. Gaining too fast? Pull back 200.</li>
              </ol>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="font-medium text-foreground">Smart swaps:</p>
              <p className="mt-1">
                Swap foods within the same category and your macros stay the same.
                Rice &harr; sweet potatoes &harr; oats. Chicken &harr; turkey &harr; lean beef.
                Almond butter &harr; avocado &harr; nuts. Check the Nutrition tab for
                the full approved foods list.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Nutrition content — Shred */}
      {isShred && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Eating for Shred</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground leading-relaxed">
            <p>
              Getting lean requires a calorie deficit. Your target is set at
              bodyweight &times; 12. Protein stays at 1g per lb to preserve
              muscle, fats at 0.3g per lb, and carbs fill the rest. Stick to
              the approved foods list.
            </p>
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
              <p className="font-medium text-foreground">What matters most:</p>
              <ol className="list-decimal list-inside space-y-1.5 ml-1">
                <li><span className="font-medium text-foreground">Protein is king.</span> In a deficit, protein preserves muscle. Hit your target every day — no exceptions.</li>
                <li><span className="font-medium text-foreground">Keep carbs around training.</span> Place most carbs before and after your workout for energy and recovery.</li>
                <li><span className="font-medium text-foreground">Don&apos;t slash fats too low.</span> Keep fats at 0.3g per lb minimum. Going below tanks hormones.</li>
                <li><span className="font-medium text-foreground">Volume eating helps.</span> Fill up on veggies, lean protein, and high-fiber foods.</li>
                <li><span className="font-medium text-foreground">Weigh yourself weekly.</span> Aim for 0.5–1 lb/week loss. Not losing? Drop 200 calories. Losing too fast? Add 200 back.</li>
              </ol>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="font-medium text-foreground">Adherence tips:</p>
              <p className="mt-1">
                Diet sodas are fine — they help control cravings. Pickles are a
                free snack. Hot sauce is unlimited. On rest days, slightly reduce
                carbs but keep protein the same. Check the Nutrition tab for
                the full approved foods list and smart swaps.
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="font-medium text-foreground">Cardio + nutrition:</p>
              <p className="mt-1">
                Your incline treadmill sessions burn roughly 200–400 calories.
                Don&apos;t eat those calories back — they&apos;re part of your deficit.
                If you&apos;re losing weight too fast (&gt;1.5 lbs/week), add food —
                don&apos;t remove cardio.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Separator className="my-8" />

      {/* ── CARDIO GUIDANCE ── */}
      <div>
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <HeartPulse className="h-5 w-5 text-rose-500" />
          Cardio
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {isShred
            ? "Steady-state cardio accelerates fat loss without killing your recovery."
            : "Light cardio supports heart health and recovery without cutting into muscle gains."}
        </p>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Zone 2 Heart Rate</CardTitle>
          <CardDescription>
            We use Zone 2 cardio — controlled, steady-state effort. Not max effort.
            If you can hold a conversation, you&apos;re in the right zone.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Formula explanation */}
          <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground space-y-2">
            <p className="font-medium text-foreground">How to find your Zone 2 range:</p>
            <div className="space-y-1">
              <p>1. Max Heart Rate = 220 &minus; your age</p>
              <p>2. Zone 2 Low = Max HR &times; 0.60</p>
              <p>3. Zone 2 High = Max HR &times; 0.70</p>
            </div>
          </div>

          {/* Interactive calculator */}
          <HeartRateCalculator />

          {/* Backup method */}
          <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
            <p className="font-medium text-foreground mb-2">
              Don&apos;t have a heart rate monitor?
            </p>
            <div className="text-muted-foreground space-y-1">
              <p>Use the &quot;talk test&quot; instead:</p>
              <p>&bull; You should be able to hold a conversation</p>
              <p>&bull; Breathing is elevated but controlled</p>
              <p>&bull; You&apos;re not out of breath</p>
            </div>
          </div>

          {/* Coaching notes */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border p-3 flex items-start gap-2">
              <Activity className="h-4 w-4 mt-0.5 text-amber-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">HR too low?</p>
                <p className="text-xs text-muted-foreground">Increase pace or incline slightly.</p>
              </div>
            </div>
            <div className="rounded-lg border border-border p-3 flex items-start gap-2">
              <Activity className="h-4 w-4 mt-0.5 text-rose-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">HR too high?</p>
                <p className="text-xs text-muted-foreground">Slow down. The goal is controlled cardio, not max effort.</p>
              </div>
            </div>
          </div>

          {isShred && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-4 text-sm">
              <p className="font-medium text-foreground">Shred cardio protocol:</p>
              <p className="text-muted-foreground mt-1">
                Incline treadmill, 20&ndash;30 minutes, 3.0&ndash;4.0 mph, 10&ndash;12
                incline. 3&ndash;5 sessions per week. Don&apos;t eat the calories
                back &mdash; they&apos;re part of your deficit.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Separator className="my-8" />

      {/* ── WEEK 1 EXPECTATIONS ── */}
      <Card>
        <CardHeader>
          <CardTitle>What to Expect Week 1</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border p-4">
              <p className="font-medium text-foreground mb-1">Soreness is normal</p>
              <p>
                You will be sore after the first few sessions. This is your body
                adapting to new training stimulus. It gets better by Week 2.
                Don&apos;t skip sessions because of soreness — move through it.
              </p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <p className="font-medium text-foreground mb-1">Weights will feel light or heavy</p>
              <p>
                Week 1 is about finding your working weights. Start lighter than
                you think. You should be able to complete all prescribed reps
                with good form. Write everything down — next week you build on it.
              </p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <p className="font-medium text-foreground mb-1">Log everything</p>
              <p>
                Use the workout logger on every exercise. Weight, reps, how it
                felt. This data is what drives your progress. If you don&apos;t log
                it, you&apos;re guessing.
              </p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <p className="font-medium text-foreground mb-1">Take starting photos</p>
              <p>
                Go to Check-in and submit your first check-in with weight and
                photos (front, side, back). You&apos;ll thank yourself in 8 weeks
                when you can see the difference.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── QUICK REFERENCE ── */}
      <Card className="mt-6 mb-8">
        <CardHeader>
          <CardTitle>Quick Reference</CardTitle>
          <CardDescription>Save this for your sessions.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <div className="flex items-center gap-3 rounded-lg border border-border p-3">
              <Badge variant="secondary">Rest: Compounds</Badge>
              <span className="text-muted-foreground">90–120 seconds</span>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-border p-3">
              <Badge variant="secondary">Rest: Isolation</Badge>
              <span className="text-muted-foreground">60–90 seconds</span>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-border p-3">
              <Badge variant="secondary">Working RPE</Badge>
              <span className="text-muted-foreground">8–9 (1–2 reps left)</span>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-border p-3">
              <Badge variant="secondary">Weight Progression</Badge>
              <span className="text-muted-foreground">Hit top of range → add weight</span>
            </div>
            {proteinTarget && (
              <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                <Badge variant="secondary">Protein</Badge>
                <span className="text-muted-foreground">{proteinTarget}g/day</span>
              </div>
            )}
            {isShred && (
              <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                <Badge variant="secondary">Cardio</Badge>
                <span className="text-muted-foreground">Incline treadmill 20–30 min, 3.0–4.0 mph, 10–12 incline</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
