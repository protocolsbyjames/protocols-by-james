"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { UserPlus } from "lucide-react";
export function InviteClientButton() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);
  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setMessage(null);
    try {
      const supabase = createClient();
      const token = crypto.randomUUID();
      const { error } = await supabase.from("invites").insert({
        email: email.trim().toLowerCase(),
        token,
      });
      if (error) throw error;
      const res = await fetch("/api/send-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), token }),
      });
      if (!res.ok) {
        throw new Error("Email delivery failed");
      }
      setMessage({ type: "success", text: "Invitation sent successfully." });
      setEmail("");
    } catch {
      setMessage({ type: "error", text: "Failed to send invite. Please try again." });
    } finally {
      setLoading(false);
    }
  }
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button />}>
        <UserPlus className="mr-2 h-4 w-4" />
        Invite Client
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Invite a Client</SheetTitle>
          <SheetDescription>
            Enter your client&apos;s email address to send them an invitation.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleInvite} className="mt-6 space-y-4 px-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              placeholder="client@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          {message && (
            <p className={`text-sm ${message.type === "success" ? "text-green-600" : "text-red-600"}`}>
              {message.text}
            </p>
          )}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Sending..." : "Send Invitation"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
