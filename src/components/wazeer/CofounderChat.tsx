import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useServerFn } from "@tanstack/react-start";
import { cofounderChat } from "@/lib/ai/cofounder.functions";
import { MessageSquare, X, Send, Sparkles, Bot, User, Loader2 } from "lucide-react";
import { toast } from "sonner";

 type Msg = { role: "user" | "assistant"; content: string };

export function CofounderChat() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content: "Hey! I'm Wazeer, your AI cofounder. Ask me anything about growing your business — strategy, marketing, pricing, or just vent about what's hard. I'm here.",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatFn = useServerFn(cofounderChat);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setLoading(true);
    try {
      const res = await chatFn({
        data: {
          message: text,
          history: messages.slice(-6),
        },
      });
      setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
      if (res.mock) {
        toast.info("AI Cofounder is in demo mode. Add LOVABLE_API_KEY for full responses.");
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to get response");
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "I'm having trouble thinking right now. Try again in a moment?" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-brand-gradient px-4 py-3 text-sm font-medium text-primary-foreground shadow-glow hover:opacity-95 transition-opacity"
        aria-label="Open AI Cofounder"
      >
        <Sparkles className="h-4 w-4" />
        AI Cofounder
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col w-[360px] max-w-[calc(100vw-2rem)] h-[500px] max-h-[calc(100vh-6rem)] rounded-2xl border bg-card shadow-elevated overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3 bg-secondary/40">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-brand-gradient grid place-items-center">
            <Bot className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <div className="text-sm font-semibold">Wazeer AI</div>
            <div className="text-[10px] text-muted-foreground">Your cofounder & strategist</div>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpen(false)} aria-label="Close chat">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-3" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`h-6 w-6 rounded-full grid place-items-center shrink-0 ${m.role === "assistant" ? "bg-brand-gradient" : "bg-secondary"}`}>
                {m.role === "assistant" ? (
                  <Bot className="h-3 w-3 text-primary-foreground" />
                ) : (
                  <User className="h-3 w-3 text-muted-foreground" />
                )}
              </div>
              <div
                className={`rounded-xl px-3 py-2 text-sm max-w-[260px] ${
                  m.role === "assistant"
                    ? "bg-secondary text-foreground"
                    : "bg-foreground text-background"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-2">
              <div className="h-6 w-6 rounded-full bg-brand-gradient grid place-items-center shrink-0">
                <Bot className="h-3 w-3 text-primary-foreground" />
              </div>
              <div className="rounded-xl px-3 py-2 bg-secondary text-sm">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-3">
        <div className="flex items-center gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask your cofounder..."
            className="flex-1 h-9 text-sm"
            disabled={loading}
          />
          <Button size="icon" className="h-9 w-9 bg-brand-gradient text-primary-foreground shrink-0" onClick={send} disabled={loading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-1.5 text-[10px] text-muted-foreground text-center">Uses 1 credit per message</p>
      </div>
    </div>
  );
}
