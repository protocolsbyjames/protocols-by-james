import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ArrowLeft } from "lucide-react";
import { MessageThread } from "@/components/messaging/message-thread";

export default async function CoachMessageThreadPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Verify client belongs to this coach
  const { data: client } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("id", clientId)
    .eq("coach_id", user.id)
    .maybeSingle();

  if (!client) {
    redirect("/coach/messages");
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center gap-3">
        <Link
          href="/coach/messages"
          className="rounded-md p-1 text-muted-foreground hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            {client.full_name}
          </h1>
          <p className="text-xs text-muted-foreground">Direct message</p>
        </div>
      </div>

      <MessageThread
        currentUserId={user.id}
        otherUserId={clientId}
        otherUserName={client.full_name ?? "Client"}
      />
    </div>
  );
}
