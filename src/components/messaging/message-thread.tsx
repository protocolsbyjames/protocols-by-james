"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

interface MessageThreadProps {
  currentUserId: string;
  otherUserId: string;
  otherUserName: string;
}

export function MessageThread({
  currentUserId,
  otherUserId,
  otherUserName,
}: MessageThreadProps) {
  const supabase = createClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadMessages = useCallback(async () => {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .or(
        `and(sender_id.eq.${currentUserId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${currentUserId})`
      )
      .order("created_at", { ascending: true })
      .limit(100);

    if (data) {
      setMessages(data);

      // Mark unread messages as read
      const unread = data.filter(
        (m) => m.receiver_id === currentUserId && !m.read_at
      );
      if (unread.length > 0) {
        await supabase
          .from("messages")
          .update({ read_at: new Date().toISOString() })
          .in(
            "id",
            unread.map((m) => m.id)
          );
      }
    }

    setLoading(false);
  }, [currentUserId, otherUserId, supabase]);

  useEffect(() => {
    loadMessages();

    // Poll every 10 seconds for new messages
    pollRef.current = setInterval(loadMessages, 10000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadMessages]);

  useEffect(() => {
    // Scroll to bottom when messages change
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!newMessage.trim()) return;
    setSending(true);

    const { error } = await supabase.from("messages").insert({
      sender_id: currentUserId,
      receiver_id: otherUserId,
      body: newMessage.trim(),
    });

    if (!error) {
      setNewMessage("");
      await loadMessages();
    }

    setSending(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)
    );

    const time = d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });

    if (diffDays === 0) return time;
    if (diffDays === 1) return `Yesterday ${time}`;
    if (diffDays < 7) {
      return `${d.toLocaleDateString("en-US", { weekday: "short" })} ${time}`;
    }
    return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${time}`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-16rem)]">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto space-y-3 px-1 py-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-sm text-muted-foreground">
              No messages yet. Start the conversation with {otherUserName}.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.sender_id === currentUserId;
            return (
              <div
                key={msg.id}
                className={`flex ${isMine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                    isMine
                      ? "bg-blue-600 text-white rounded-br-md"
                      : "bg-muted text-foreground rounded-bl-md"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                  <p
                    className={`text-[10px] mt-1 ${
                      isMine ? "text-blue-200" : "text-muted-foreground"
                    }`}
                  >
                    {formatTime(msg.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-border pt-3 pb-1">
        <div className="flex items-end gap-2">
          <Textarea
            placeholder={`Message ${otherUserName}...`}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            className="min-h-[40px] max-h-[120px] resize-none"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={sending || !newMessage.trim()}
            className="h-10 w-10 flex-shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
