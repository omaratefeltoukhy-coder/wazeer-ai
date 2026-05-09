import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/wazeer/Navbar";
import { Footer } from "@/components/wazeer/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Mail, MessageSquare, Clock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — Wazeer AI" },
      { name: "description", content: "Get in touch with the Wazeer AI team for sales, support, or partnership inquiries." },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Placeholder: in production, send to a support endpoint
    await new Promise((r) => setTimeout(r, 800));
    setLoading(false);
    toast.success("Message sent", { description: "We'll get back to you within 24 hours." });
    setName("");
    setEmail("");
    setMessage("");
  };

  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <section className="pt-24 pb-10">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Let's <span className="text-gradient">talk.</span>
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Questions about pricing, features, or partnerships? We're here to help.
          </p>
        </div>
      </section>

      <section className="pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid lg:grid-cols-3 gap-10">
          <div className="lg:col-span-1 space-y-6">
            <div className="rounded-2xl border bg-card p-5 shadow-soft">
              <div className="flex items-center gap-3 mb-2">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-medium">Email us</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                <a href="mailto:sales@wazeer.ai" className="text-foreground hover:underline">sales@wazeer.ai</a>
              </p>
            </div>
            <div className="rounded-2xl border bg-card p-5 shadow-soft">
              <div className="flex items-center gap-3 mb-2">
                <MessageSquare className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-medium">Live chat</h3>
              </div>
              <p className="text-sm text-muted-foreground">Available for Pro and Agency plans.</p>
            </div>
            <div className="rounded-2xl border bg-card p-5 shadow-soft">
              <div className="flex items-center gap-3 mb-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-medium">Response time</h3>
              </div>
              <p className="text-sm text-muted-foreground">We aim to respond within 24 hours on business days.</p>
            </div>
          </div>

          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="rounded-2xl border bg-card p-6 shadow-soft space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>
              <div>
                <Label htmlFor="message">Message</Label>
                <Textarea id="message" rows={5} required value={message} onChange={(e) => setMessage(e.target.value)} />
              </div>
              <Button type="submit" className="w-full bg-brand-gradient text-primary-foreground" disabled={loading}>
                {loading ? "Sending…" : "Send message"}
              </Button>
            </form>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
