export type CreditPack = {
  id: string;
  credits: number;
  price_usd: number;
  bonus_pct?: number;
  badge?: string;
};

export const CREDIT_PACKS: CreditPack[] = [
  { id: "pack_500", credits: 500, price_usd: 9 },
  { id: "pack_1500", credits: 1500, price_usd: 24, bonus_pct: 10, badge: "+10% bonus" },
  { id: "pack_5000", credits: 5000, price_usd: 69, bonus_pct: 20, badge: "Best value" },
  { id: "pack_15000", credits: 15000, price_usd: 179, bonus_pct: 25, badge: "+25% bonus" },
];

export function getPack(id: string): CreditPack | undefined {
  return CREDIT_PACKS.find((p) => p.id === id);
}
