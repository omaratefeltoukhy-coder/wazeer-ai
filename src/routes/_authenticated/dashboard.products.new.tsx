import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type ChangeEvent } from "react";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PRODUCT_TYPES, productTypeMeta, type ProductType } from "@/lib/products/types";
import { ArrowLeft, Loader2, Upload, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const ALL_TYPES = PRODUCT_TYPES.map((p) => p.id) as [ProductType, ...ProductType[]];

const searchSchema = z.object({
  type: z.enum(ALL_TYPES).optional(),
});

export const Route = createFileRoute("/_authenticated/dashboard/products/new")({
  validateSearch: zodValidator(searchSchema),
  component: NewProductPage,
});

type Module = { title: string; lessons: string[] };

function NewProductPage() {
  const { type } = Route.useSearch();
  const navigate = useNavigate();

  const [productType, setProductType] = useState<ProductType>(type ?? "physical_product");
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isFree, setIsFree] = useState(false);
  const [price, setPrice] = useState("0");
  const [currency, setCurrency] = useState("USD");
  const [coverUrl, setCoverUrl] = useState<string>("");
  const [coverUploading, setCoverUploading] = useState(false);
  const [fileUrl, setFileUrl] = useState<string>("");
  const [fileUploading, setFileUploading] = useState(false);
  const [fileName, setFileName] = useState<string>("");
  const [modules, setModules] = useState<Module[]>([{ title: "Module 1", lessons: [""] }]);
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [calendarLink, setCalendarLink] = useState("");
  const [billingInterval, setBillingInterval] = useState<"month" | "year">("month");
  const [accessLevel, setAccessLevel] = useState<"basic" | "premium">("basic");
  const [publish, setPublish] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!mounted) return;
      setUserId(u.user?.id ?? null);
      const { data: m } = await supabase.from("workspace_members").select("workspace_id").limit(1).maybeSingle();
      if (m?.workspace_id && mounted) setWorkspaceId(m.workspace_id);
      const { data: b } = await supabase.from("businesses").select("id").order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!mounted) return;
      setBusinessId(b?.id ?? null);
    })().catch(() => {
      if (!mounted) return;
      setUserId(null);
      setWorkspaceId(null);
      setBusinessId(null);
    });
    return () => { mounted = false; };
  }, []);

  const uploadCover = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId || !workspaceId) return;
    setCoverUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${workspaceId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("product-covers").upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("product-covers").getPublicUrl(path);
      setCoverUrl(data.publicUrl);
      toast.success("Cover uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setCoverUploading(false);
    }
  };

  const uploadFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setFileUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("product-files").upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      setFileUrl(path);
      setFileName(file.name);
      toast.success("File uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setFileUploading(false);
    }
  };

  const addModule = () => setModules((m) => [...m, { title: `Module ${m.length + 1}`, lessons: [""] }]);
  const updateModule = (i: number, patch: Partial<Module>) =>
    setModules((m) => m.map((mod, idx) => (idx === i ? { ...mod, ...patch } : mod)));
  const removeModule = (i: number) => setModules((m) => m.filter((_, idx) => idx !== i));

  const save = async () => {
    if (!workspaceId || !userId) return toast.error("Workspace not ready");
    if (!title.trim()) return toast.error("Add a title to continue");
    setSaving(true);
    try {
      const metadata: Record<string, unknown> = {};
      if (productType === "digital_file") metadata.file = { path: fileUrl, name: fileName };
      if (productType === "online_course") metadata.modules = modules;
      if (productType === "live_event") metadata.event = { date: eventDate, time: eventTime, location: eventLocation };
      if (productType === "coaching") metadata.calendar_link = calendarLink;
      if (productType === "membership") metadata.subscription = { interval: billingInterval, access_level: accessLevel };

      const insert = {
        workspace_id: workspaceId,
        business_id: businessId,
        user_id: userId,
        type: productType,
        title: title.trim(),
        description: description.trim() || null,
        price: isFree ? 0 : Number(price) || 0,
        currency,
        status: (publish ? "published" : "draft") as "published" | "draft",
        cover_image_url: coverUrl || null,
        metadata: metadata as never,
      };
      const { data, error } = await supabase.from("products").insert(insert).select("id").single();
      if (error) throw error;
      toast.success("Product created");
      navigate({ to: "/dashboard/products/$productId", params: { productId: data.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save product");
    } finally {
      setSaving(false);
    }
  };

  const meta = productTypeMeta(productType);

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto space-y-6">
      <Link to="/dashboard/products" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to products
      </Link>

      <header>
        <div className="text-2xl">{meta.emoji}</div>
        <h1 className="text-2xl font-semibold mt-1">New {meta.label}</h1>
        <p className="text-sm text-muted-foreground">{meta.description}</p>
      </header>

      <section className="rounded-2xl border bg-card p-5 space-y-4">
        <div>
          <Label>Product type</Label>
          <Select value={productType} onValueChange={(v) => setProductType(v as ProductType)}>
            <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRODUCT_TYPES.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.emoji} {t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Title</Label>
          <Input className="mt-1.5" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. The Founder's Playbook" />
        </div>

        <div>
          <Label>Description</Label>
          <Textarea className="mt-1.5" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What customers get and why they'll love it." />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 flex items-center justify-between rounded-lg border p-3">
            <div>
              <div className="text-sm font-medium">Free</div>
              <div className="text-xs text-muted-foreground">Offer this product without charge.</div>
            </div>
            <Switch checked={isFree} onCheckedChange={setIsFree} />
          </div>
          {!isFree && (
            <>
              <div>
                <Label>Price</Label>
                <Input className="mt-1.5" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
              </div>
              <div>
                <Label>Currency</Label>
                <Input className="mt-1.5" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} />
              </div>
            </>
          )}
        </div>
      </section>

      {/* Type-specific fields */}
      {productType === "digital_file" && (
        <section className="rounded-2xl border bg-card p-5 space-y-3">
          <Label>Downloadable file</Label>
          <label className="flex items-center justify-between rounded-lg border border-dashed p-4 cursor-pointer hover:bg-secondary/40">
            <div className="flex items-center gap-3 text-sm">
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span>{fileName || "Choose a file (PDF, ZIP, etc.)"}</span>
            </div>
            {fileUploading && <Loader2 className="h-4 w-4 animate-spin" />}
            <input type="file" className="hidden" onChange={uploadFile} />
          </label>
        </section>
      )}

      {productType === "online_course" && (
        <section className="rounded-2xl border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <Label>Modules & lessons</Label>
            <Button type="button" variant="outline" size="sm" onClick={addModule}><Plus className="h-3.5 w-3.5" /> Add module</Button>
          </div>
          {modules.map((m, i) => (
            <div key={i} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Input value={m.title} onChange={(e) => updateModule(i, { title: e.target.value })} placeholder="Module title" />
                <Button type="button" variant="ghost" size="icon" onClick={() => removeModule(i)}><Trash2 className="h-4 w-4" /></Button>
              </div>
              {m.lessons.map((l, li) => (
                <Input key={li} value={l} onChange={(e) => {
                  const next = [...m.lessons]; next[li] = e.target.value;
                  updateModule(i, { lessons: next });
                }} placeholder={`Lesson ${li + 1}`} />
              ))}
              <Button type="button" variant="ghost" size="sm" onClick={() => updateModule(i, { lessons: [...m.lessons, ""] })}><Plus className="h-3.5 w-3.5" /> Add lesson</Button>
            </div>
          ))}
        </section>
      )}

      {productType === "live_event" && (
        <section className="rounded-2xl border bg-card p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Date</Label><Input className="mt-1.5" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} /></div>
            <div><Label>Time</Label><Input className="mt-1.5" type="time" value={eventTime} onChange={(e) => setEventTime(e.target.value)} /></div>
          </div>
          <div><Label>Location or online link</Label><Input className="mt-1.5" value={eventLocation} onChange={(e) => setEventLocation(e.target.value)} placeholder="Address or Zoom URL" /></div>
        </section>
      )}

      {productType === "coaching" && (
        <section className="rounded-2xl border bg-card p-5 space-y-3">
          <Label>Calendar / availability link</Label>
          <Input value={calendarLink} onChange={(e) => setCalendarLink(e.target.value)} placeholder="https://calendly.com/you" />
        </section>
      )}

      {productType === "membership" && (
        <section className="rounded-2xl border bg-card p-5 grid grid-cols-2 gap-3">
          <div>
            <Label>Billing interval</Label>
            <Select value={billingInterval} onValueChange={(v) => setBillingInterval(v as "month" | "year")}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Monthly</SelectItem>
                <SelectItem value="year">Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Access level</Label>
            <Select value={accessLevel} onValueChange={(v) => setAccessLevel(v as "basic" | "premium")}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="basic">Basic</SelectItem>
                <SelectItem value="premium">Premium</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </section>
      )}

      <section className="rounded-2xl border bg-card p-5 space-y-3">
        <Label>Cover image</Label>
        {coverUrl && <img src={coverUrl} alt="Cover" className="h-32 w-full object-cover rounded-lg border" />}
        <label className="flex items-center justify-between rounded-lg border border-dashed p-4 cursor-pointer hover:bg-secondary/40">
          <div className="flex items-center gap-3 text-sm">
            <Upload className="h-4 w-4 text-muted-foreground" />
            <span>{coverUrl ? "Replace cover image" : "Upload a cover image"}</span>
          </div>
          {coverUploading && <Loader2 className="h-4 w-4 animate-spin" />}
          <input type="file" accept="image/*" className="hidden" onChange={uploadCover} />
        </label>
      </section>

      <section className="rounded-2xl border bg-card p-5 flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">Publish immediately</div>
          <div className="text-xs text-muted-foreground">Otherwise the product is saved as a draft.</div>
        </div>
        <Switch checked={publish} onCheckedChange={setPublish} />
      </section>

      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={() => navigate({ to: "/dashboard/products" })}>Cancel</Button>
        <Button onClick={save} disabled={saving} className="bg-brand-gradient text-primary-foreground shadow-glow">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save product"}
        </Button>
      </div>
    </div>
  );
}
