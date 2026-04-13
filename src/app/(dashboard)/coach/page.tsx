import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users } from "lucide-react";
import { InviteClientButton } from "./invite-client-button";

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default async function CoachDashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: clients } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, subscriptions:subscriptions!subscriptions_client_id_fkey(status)")
    .eq("coach_id", user.id)
    .eq("role", "client")
    .order("full_name");

  const clientList = (clients ?? []).map((c) => ({
    ...c,
    subscription_status:
      (c.subscriptions as { status: string }[] | null)?.[0]?.status ?? null,
  }));

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Client Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage your clients and their programs.
          </p>
        </div>
        <InviteClientButton />
      </div>

      {clientList.length === 0 ? (
        <div className="mt-12 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-16">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
            <Users className="h-7 w-7 text-slate-400" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-slate-900">
            No clients yet
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Invite your first client to get started.
          </p>
          <div className="mt-6">
            <InviteClientButton />
          </div>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clientList.map((client) => (
            <Link key={client.id} href={`/coach/clients/${client.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardHeader className="flex flex-row items-center gap-4 space-y-0 pb-3">
                  <Avatar className="h-11 w-11">
                    <AvatarImage
                      src={client.avatar_url ?? undefined}
                      alt={client.full_name ?? "Client"}
                    />
                    <AvatarFallback className="bg-slate-100 text-sm font-medium text-slate-600">
                      {getInitials(client.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <CardTitle className="text-base">
                      {client.full_name ?? "Unnamed Client"}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <Badge
                    variant={
                      client.subscription_status === "active"
                        ? "default"
                        : "secondary"
                    }
                    className="text-xs"
                  >
                    {client.subscription_status ?? "No subscription"}
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
