import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Mail, Phone, Video } from "lucide-react";

export const metadata = {
  title: "Peptalks · Coach · Protocols by James",
};

export const dynamic = "force-dynamic";

type BookingRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  topic: string;
  scheduled_at: string;
  duration_minutes: number;
  timezone: string;
  status: string;
  meet_link: string | null;
};

/**
 * /coach/peptalks — James's private view of every peptalk booking.
 *
 * Surfaced separately from the clients list because most peptalkers are
 * cold leads without a profile. The list is split into:
 *   - Upcoming (status=confirmed, scheduled_at >= now) — cards at top
 *   - Past (scheduled_at < now) — collapsed below
 *
 * Only coach accounts can hit this route (RLS policy on peptalk_bookings
 * already enforces "coach reads all"). We still double-check the role
 * server-side for defense in depth.
 */
export default async function PeptalksPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "coach") redirect("/client");

  // RLS policy lets coaches read all peptalk_bookings.
  const { data: bookings } = await supabase
    .from("peptalk_bookings")
    .select(
      "id, full_name, email, phone, topic, scheduled_at, duration_minutes, timezone, status, meet_link",
    )
    .order("scheduled_at", { ascending: true })
    .returns<BookingRow[]>();

  const now = Date.now();
  const all = bookings ?? [];
  const upcoming = all.filter(
    (b) => b.status === "confirmed" && new Date(b.scheduled_at).getTime() >= now,
  );
  const past = all
    .filter((b) => new Date(b.scheduled_at).getTime() < now)
    .reverse();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Peptalks
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Incoming consultation bookings from the marketing site.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          Upcoming ({upcoming.length})
        </h2>
        {upcoming.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">No upcoming peptalks</CardTitle>
              <CardDescription>
                When someone books at /peptalk/book, they&apos;ll show up here.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {upcoming.map((b) => (
              <BookingCard key={b.id} booking={b} variant="upcoming" />
            ))}
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            Past ({past.length})
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {past.slice(0, 12).map((b) => (
              <BookingCard key={b.id} booking={b} variant="past" />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function BookingCard({
  booking,
  variant,
}: {
  booking: BookingRow;
  variant: "upcoming" | "past";
}) {
  const when = formatWhen(booking.scheduled_at, booking.timezone);
  const statusVariant =
    booking.status === "confirmed"
      ? "default"
      : booking.status === "canceled"
        ? "destructive"
        : "secondary";

  return (
    <Card className={variant === "past" ? "opacity-75" : undefined}>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{booking.full_name}</CardTitle>
            <CardDescription>
              {when.day} · {when.time} · {booking.duration_minutes}m
            </CardDescription>
          </div>
          <Badge variant={statusVariant}>{booking.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center gap-2 text-slate-600">
          <Mail className="h-4 w-4 shrink-0" />
          <a
            href={`mailto:${booking.email}`}
            className="hover:underline truncate"
          >
            {booking.email}
          </a>
        </div>
        <div className="flex items-center gap-2 text-slate-600">
          <Phone className="h-4 w-4 shrink-0" />
          <a href={`tel:${booking.phone}`} className="hover:underline">
            {booking.phone}
          </a>
        </div>
        {booking.meet_link && (
          <div className="flex items-center gap-2 text-slate-600">
            <Video className="h-4 w-4 shrink-0" />
            <a
              href={booking.meet_link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-600 hover:underline truncate"
            >
              Join Google Meet
            </a>
          </div>
        )}
        <div className="rounded-md bg-slate-50 p-3 text-slate-700">
          <div className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <Calendar className="h-3 w-3" />
            Topic
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {booking.topic}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function formatWhen(iso: string, timezone: string): { day: string; time: string } {
  const d = new Date(iso);
  return {
    day: new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: timezone || "America/Los_Angeles",
    }).format(d),
    time: new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZoneName: "short",
      timeZone: timezone || "America/Los_Angeles",
    }).format(d),
  };
}
