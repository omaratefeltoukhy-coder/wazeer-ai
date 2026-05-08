import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqs = [
  { q: "Do I need marketing or design skills?", a: "No. Wazeer AI writes the copy, designs the images, edits the videos, and recommends what to do next. You just approve." },
  { q: "Will it auto-publish my ads and emails?", a: "Never without your approval. Everything launches in approval mode by default — you stay in control." },
  { q: "Which platforms are supported?", a: "Facebook, Instagram, Meta Ads, and email out of the box. More integrations are added every month." },
  { q: "Can I use my own product photos?", a: "Yes — upload a photo or video and Wazeer AI will preserve product identity and generate matching creative around it." },
  { q: "Can I cancel anytime?", a: "Yes. Cancel from the billing portal in one click. Your trial is free for 7 days." },
];

export function FAQ() {
  return (
    <section id="faq" className="py-24 bg-secondary/40 border-y">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <p className="text-sm font-medium text-royal text-center">FAQ</p>
        <h2 className="mt-2 text-3xl sm:text-4xl font-bold text-center">Questions, answered</h2>
        <Accordion type="single" collapsible className="mt-10">
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={`q-${i}`} className="border-b">
              <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
