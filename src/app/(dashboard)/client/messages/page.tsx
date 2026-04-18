import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MessageThread } from "@/components/messaging/message-thread";

export default async function ClientMessagesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Find the client's coach
  const { data: profile } = await supabase
    .from("profiles")
    .select("coach_id")
    .eq("id", user.id)
    .maybeSingle();

  const coachId = profile?.coach_id;

  if (!coachId) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Messages
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You don&apos;t have a coach assigned yet. Messages will be available
          once you&apos;re connected with your coach.
        </p>
      </div>
    );
  }

  // Get coach name
  const { data: coach } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", coachId)
    .maybeSingle();

  const coachName = coach?.full_name ?? "Your Coach";

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Messages
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Chat with {coachName}
        </p>
      </div>

      <MessageThread
        currentUserId={user.id}
        otherUserId={coachId}
        otherUserName={coachName}
      />
    </div>
  );
}
