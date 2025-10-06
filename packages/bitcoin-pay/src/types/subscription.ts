/**
 * Subscription types for recurring Bitcoin payments
 */

export type SubscriptionInterval = "daily" | "weekly" | "monthly" | "yearly";

export type SubscriptionStatus =
  | "active" // Active and current on payments
  | "trialing" // In trial period
  | "past_due" // Payment failed, in grace period
  | "canceled" // Canceled by user
  | "expired"; // Reached maxCycles or past_due grace period ended

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string | null;
  amountSats: number;
  currency: string;
  interval: SubscriptionInterval;
  intervalCount: number;
  maxCycles: number | null;
  trialDays: number | null;
  metadata: Record<string, unknown> | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Subscription {
  id: string;
  planId: string;
  customerId: string | null;
  customerEmail: string | null;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialStart: Date | null;
  trialEnd: Date | null;
  cyclesCompleted: number;
  lastPaymentIntentId: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: Date | null;
  cancelReason: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSubscriptionPlanInput {
  id: string;
  name: string;
  description?: string;
  amountSats: number;
  interval: SubscriptionInterval;
  intervalCount?: number;
  maxCycles?: number;
  trialDays?: number;
  metadata?: Record<string, unknown>;
}

export interface CreateSubscriptionInput {
  planId: string;
  customerId?: string;
  customerEmail?: string;
  trialDays?: number; // Override plan's trial
  metadata?: Record<string, unknown>;
  startDate?: Date; // When to start (default: now)
}

export interface UpdateSubscriptionInput {
  cancelAtPeriodEnd?: boolean;
  cancelReason?: string;
  metadata?: Record<string, unknown>;
}

export interface SubscriptionFilters {
  customerId?: string;
  status?: SubscriptionStatus | SubscriptionStatus[];
  planId?: string;
  currentPeriodEndBefore?: Date;
  currentPeriodEndAfter?: Date;
}

export interface SubscriptionConfig {
  plans: CreateSubscriptionPlanInput[];
  autoSync?: boolean; // Default: true
  gracePeriodDays?: number; // How long to keep past_due before expiring (default: 3)
}
