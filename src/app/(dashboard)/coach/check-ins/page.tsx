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
import { ClipboardCheck, MessageSquare } from "lucide-react";

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

interface CheckInRow {
  id: string;
  client_id: string;
  week_of: string;
  weight_lbs: number | null;
  energy_level: number | null;
  adherence_rating: number | null;
  created_at: string;
  coach_feedback: { id: string }[] | null;
  client:
    | { id: string; full_name: string | null; avatar_url: string | null }
    | { id: string; full_name: string | null; avatar_url: string | null }[]
    | null;
}

export default async function CoachCheckInsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get this coach's client IDs first so RLS scopes cleanly
  const { data: coachClients } = await supabase
    .from("profiles")
    .select("id")
    .eq("coach_id", user.id)
    .eq("role", "client");

  const clientIds = (coachClients ?? []).map((c) => c.id);

  let checkIns: CheckInRow[] = [];
  if (clientIds.length > 0) {
    const { data } = await supabase
      .from("check_ins")
      .select(
        "id, client_id, week_of, weight_lbs, energy_level, adherence_rating, created_at, coach_feedback(id), client:profiles!check_ins_client_id_fkey(id, full_name, avatar_url)"
      )
      .in("client_id", clientIds)
      .order("week_of", { ascending: false })
      .limit(50);
    checkIns = (data ?? []) as CheckInRow[];
  }

  const pendingCount = checkIns.filter(
    (c) => !(c.coach_feedback && c.coach_feedback.length > 0)
  ).length;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Check-ins
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review client check-ins and leave feedback.
          </p>
        </div>
        {pendingCount > 0 && (
          <Badge variant="secondary" className="text-xs">
            {pendingCount} pending feedback
          </Badge>
        )}
      </div>

      {checkIns.length === 0 ? (
        <div className="mt-12 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-16">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <ClipboardCheck className="h-7 w-7 text-muted-foreground" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-foreground">
            No check-ins yet
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your clients haven&apos;t submitted any check-ins yet.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {checkIns.map((checkIn) => {
            const client = Array.isArray(checkIn.client)
              ? checkIn.client[0]
              : checkIn.client;
            const hasFeedback =
              !!checkIn.coach_feedback && checkIn.coach_feedback.length > 0;

            return (
              <Link
                key={checkIn.id}
                href={`/coach/check-ins/${checkIn.id}`}
                className="block"
              >
                <Card className="transition-shadow hover:shadow-md">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage
                            src={client?.avatar_url ?? undefined}
                            alt={client?.full_name ?? "Client"}
                          />
                          <AvatarFallback className="bg-muted text-sm font-medium text-muted-foreground">
                            {getInitials(client?.full_name ?? null)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle className="text-base">
                            {client?.full_name ?? "Client"}
                          </CardTitle>
                          <CardDescription className="text-xs">
                            Week of {checkIn.week_of}
                          </CardDescription>
                        </div>
                      </div>
                      {hasFeedback ? (
                        <Badge variant="default" className="text-xs">
                          Reviewed
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-amber-300 bg-amber-50 text-xs text-amber-700"
                        >
                          <MessageSquare className="mr-1 h-3 w-3" />
                          Needs feedback
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      {checkIn.weight_lbs != null && (
                        <span>
                          <span className="font-medium text-foreground">
                            {checkIn.weight_lbs}
                          </span>{" "}
                          lbs
                        </span>
                      )}
                      {checkIn.energy_level != null && (
                        <span>
                          Energy:{" "}
                          <span className="font-medium text-foreground">
                            {checkIn.energy_level}/5
                          </span>
                        </span>
                      )}
                      {checkIn.adherence_rating != null && (
                        <span>
                          Adherence:{" "}
                          <span className="font-medium text-foreground">
                            {checkIn.adherence_rating}/5
                          </span>
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
