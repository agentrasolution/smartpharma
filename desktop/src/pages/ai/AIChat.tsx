import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Send, Bot, User, MessageSquare, Loader2 } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import type { AIConversation, AIConversationMessage } from "@/types";

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export default function AIChat() {
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: conversations = [] } = useQuery({
    queryKey: ["ai-conversations"],
    queryFn: () => api.ai.chat.conversations(50),
  });

  const sendMutation = useMutation({
    mutationFn: (msg: string) => api.ai.chat.send(msg, conversationId),
    onSuccess: (res) => {
      setConversationId(res.conversationId);
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: "assistant", content: res.reply },
      ]);
      setInput("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const loadConv = useMutation({
    mutationFn: (id: string) => api.ai.chat.conversation(id),
    onSuccess: (conv) => {
      setConversationId(conv.id);
      const msgs = conv.messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ id: m.id, role: m.role as "user" | "assistant", content: m.content }));
      setMessages(msgs);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend() {
    const msg = input.trim();
    if (!msg) return;
    if (sendMutation.isPending) return;
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", content: msg }]);
    sendMutation.mutate(msg);
  }

  function newConversation() {
    setConversationId(undefined);
    setMessages([]);
    setInput("");
  }

  return (
    <div>
      <PageHeader
        title="AI Assistant"
        description="Inventory intelligence chat — ask about stock, demand, and reorders"
        action={{ label: "New Chat", onClick: newConversation }}
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-1 rounded-xl border border-border bg-surface overflow-hidden">
          <div className="px-4 py-3 border-b border-border/60 flex items-center gap-2">
            <Bot className="h-4 w-4 text-accent" />
            <span className="text-xs font-semibold text-text-primary uppercase tracking-wide">Conversations</span>
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {conversations.length === 0 && (
              <div className="text-center text-text-secondary py-8 text-xs">No prior conversations</div>
            )}
            {conversations.map((c: AIConversation) => (
              <button
                key={c.id}
                onClick={() => loadConv.mutate(c.id)}
                className={`w-full text-left px-4 py-2.5 hover:bg-surface-2 transition-colors border-b border-border/40 ${conversationId === c.id ? "bg-surface-2" : ""}`}
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-3.5 w-3.5 text-text-secondary shrink-0" />
                  <span className="text-xs text-text-primary truncate">{c.title}</span>
                </div>
                <span className="text-[10px] text-text-secondary ml-5">{c._count?.messages ?? 0} messages</span>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-3 rounded-xl border border-border bg-surface flex flex-col overflow-hidden" style={{ height: "calc(100vh - 220px)" }}>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-text-secondary py-16 text-sm">
                Ask the AI assistant about your inventory, e.g.
                <div className="mt-3 space-y-1 text-xs">
                  <div>• "Which products are critically low on stock?"</div>
                  <div>• "What should I reorder this week?"</div>
                  <div>• "Generate a purchase order draft for critical items"</div>
                </div>
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`flex gap-2 max-w-[85%] ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div className={`h-7 w-7 rounded-lg shrink-0 flex items-center justify-center ${m.role === "user" ? "bg-accent/15 text-accent" : "bg-surface-2 text-text-secondary"}`}>
                    {m.role === "user" ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                  </div>
                  <div className={`rounded-lg px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${m.role === "user" ? "bg-accent/10 text-text-primary" : "bg-surface-2 text-text-primary"}`}>
                    {m.content}
                  </div>
                </div>
              </div>
            ))}
            {sendMutation.isPending && (
              <div className="flex justify-start">
                <div className="flex gap-2">
                  <div className="h-7 w-7 rounded-lg bg-surface-2 flex items-center justify-center text-text-secondary">
                    <Bot className="h-3.5 w-3.5" />
                  </div>
                  <div className="rounded-lg px-3 py-2 bg-surface-2 flex items-center gap-2 text-xs text-text-secondary">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking...
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="p-3 border-t border-border/60 flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
              placeholder="Ask about inventory, demand, or reorder suggestions..."
              className="flex-1"
            />
            <Button onClick={handleSend} disabled={sendMutation.isPending || !input.trim()} size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
