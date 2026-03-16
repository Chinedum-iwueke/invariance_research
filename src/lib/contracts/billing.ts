import type { PlanId } from "@/lib/contracts/account";

export interface PlanCatalogEntry {
  id: PlanId;
  label: string;
  stripe_price_id?: string;
  self_serve_checkout: boolean;
  description: string;
}
