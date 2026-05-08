import type { LucideIcon } from "lucide-react";
import {
  Package, FileText, GraduationCap, Calendar, User, Trophy, ClipboardList, Crown,
} from "lucide-react";

export type ProductType =
  | "physical_product"
  | "digital_file"
  | "online_course"
  | "live_event"
  | "coaching"
  | "challenge"
  | "lead_form"
  | "membership";

export type ProductStatus = "draft" | "published" | "archived";

export type ProductRow = {
  id: string;
  workspace_id: string;
  business_id: string | null;
  user_id: string;
  type: ProductType;
  title: string;
  description: string | null;
  price: number;
  currency: string;
  status: ProductStatus;
  cover_image_url: string | null;
  metadata: Record<string, unknown>;
  sales_count: number;
  revenue_total: number;
  created_at: string;
  updated_at: string;
};

export type ProductTypeMeta = {
  id: ProductType;
  label: string;
  emoji: string;
  description: string;
  icon: LucideIcon;
};

export const PRODUCT_TYPES: ProductTypeMeta[] = [
  { id: "physical_product", label: "Physical Product", emoji: "📦", description: "Sell a tangible item you ship", icon: Package },
  { id: "digital_file", label: "Digital File", emoji: "📄", description: "Sell an ebook, PDF, or download", icon: FileText },
  { id: "online_course", label: "Online Course", emoji: "🎓", description: "Sell structured video lessons", icon: GraduationCap },
  { id: "live_event", label: "Live Event", emoji: "📅", description: "Sell tickets to a live session", icon: Calendar },
  { id: "coaching", label: "1:1 Coaching", emoji: "👤", description: "Sell your time and expertise", icon: User },
  { id: "challenge", label: "Challenge", emoji: "🏆", description: "Run a paid challenge or bootcamp", icon: Trophy },
  { id: "lead_form", label: "Lead Form", emoji: "📋", description: "Collect leads with a free opt-in", icon: ClipboardList },
  { id: "membership", label: "Membership", emoji: "💎", description: "Sell recurring access", icon: Crown },
];

export function productTypeMeta(t: ProductType): ProductTypeMeta {
  return PRODUCT_TYPES.find((p) => p.id === t) ?? PRODUCT_TYPES[0];
}
