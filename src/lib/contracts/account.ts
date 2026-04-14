export type PlanId = "explorer" | "professional" | "research_lab" | "advisory";
export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid";

export interface User {
  user_id: string;
  email: string;
  name?: string;
  created_at: string;
  last_login_at?: string;
  password_hash?: string;
  password_updated_at?: string;
}

export interface Account {
  account_id: string;
  owner_user_id: string;
  plan_id: PlanId;
  subscription_status: SubscriptionStatus;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  subscription_id: string;
  account_id: string;
  provider: "stripe";
  provider_customer_id: string;
  provider_subscription_id: string;
  plan_id: PlanId;
  status: SubscriptionStatus;
  current_period_start?: string;
  current_period_end?: string;
  cancel_at_period_end: boolean;
}
