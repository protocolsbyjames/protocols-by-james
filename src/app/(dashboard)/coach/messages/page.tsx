import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MessageSquare } from "lucide-react";

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default async function CoachMessagesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Get all coach's clients
  const { data: clients } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .eq("coach_id", user.id)
    .eq("role", "client")
    .order("full_name");

  const clientList = clients ?? [];

  // For each client, get latest message + unread count
  const conversationData = await Promise.all(
    clientList.map(async (client) => {
      // Latest message
      const { data: latest } = await supabase
        .from("messages")
        .select("body, sender_id, created_at")
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${client.id}),and(sender_id.eq.${client.id},receiver_id.eq.${user.id})`
        )
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Unread count
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("sender_id", client.id)
        .eq("receiver_id", user.id)
        .is("read_at", null);

      return {
        client,
        lastMessage: latest,
        unreadCount: count ?? 0,
      };
    })
  );

  // Sort: unread first, then by latest message time
  conversationData.sort((a, b) => {
    if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
    if (b.unreadCount > 0 && a.unreadCount === 0) return 1;
    const aTime = a.lastMessage?.created_at ?? "";
    const bTime = b.lastMessage?.created_at ?? "";
    return bTime.localeCompare(aTime);
  });

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Messages
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Direct messages with your clients.
        </p>
      </div>

      {clientList.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No clients yet. Invite clients to start messaging.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {conversationData.map(({ client, lastMessage, unreadCount }) => (
            <Link
              key={client.id}
              href={`/coach/messages/${client.id}`}
              className="block"
            >
              <Card className="border-border hover:border-foreground/20 hover:bg-muted/30 transition-colors">
                <CardContent className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage
                        src={client.avatar_url ?? undefined}
                        alt={client.full_name ?? "Client"}
                      />
                      <AvatarFallback className="bg-muted text-sm">
                        {getInitials(client.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-foreground">
                          {client.full_name}
                        </p>
                        {lastMessage && (
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(lastMessage.created_at).toLocaleDateString(
                              "en-US",
                              { month: "short", day: "numeric" }
                            )}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <p className="text-xs text-muted-foreground truncate pr-2">
                          {lastMessage
                            ? `${lastMessage.sender_id === user.id ? "You: " : ""}${lastMessage.body}`
                            : "No messages yet"}
                        </p>
                        {unreadCount > 0 && (
                          <Badge className="h-5 min-w-[20px] text-[10px] flex items-center justify-center px-1.5">
                            {unreadCount}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
