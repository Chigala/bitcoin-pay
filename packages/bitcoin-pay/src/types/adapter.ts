import type {
  PaymentIntent,
  DepositAddress,
  TxObservation,
  MagicLinkToken,
  Customer,
} from "./models";
import type {
  SubscriptionPlan,
  Subscription,
  CreateSubscriptionPlanInput,
  SubscriptionFilters,
} from "./subscription";

export interface StorageAdapter {
  createPaymentIntent(
    data: Omit<PaymentIntent, "id" | "createdAt" | "updatedAt">
  ): Promise<PaymentIntent>;
  getPaymentIntent(id: string): Promise<PaymentIntent | null>;
  updatePaymentIntent(
    id: string,
    data: Partial<PaymentIntent>
  ): Promise<PaymentIntent>;
  listPaymentIntentsByStatus(
    status: PaymentIntent["status"]
  ): Promise<PaymentIntent[]>;

  createDepositAddress(
    data: Omit<DepositAddress, "id" | "createdAt" | "updatedAt">
  ): Promise<DepositAddress>;
  getDepositAddress(id: string): Promise<DepositAddress | null>;
  getDepositAddressByAddress(address: string): Promise<DepositAddress | null>;
  getUnassignedAddress(): Promise<DepositAddress | null>;
  assignAddressToIntent(
    addressId: string,
    intentId: string
  ): Promise<DepositAddress>;
  getNextDerivationIndex(): Promise<number>;
  listAssignedAddresses(): Promise<DepositAddress[]>;

  createTxObservation(
    data: Omit<TxObservation, "id" | "createdAt" | "updatedAt">
  ): Promise<TxObservation>;
  upsertTxObservation(
    data: Omit<TxObservation, "id" | "createdAt" | "updatedAt">
  ): Promise<TxObservation>;
  getTxObservationsByIntent(intentId: string): Promise<TxObservation[]>;
  getTxObservationByTxid(txid: string): Promise<TxObservation | null>;
  getTxObservationByTxidVout(
    txid: string,
    vout: number
  ): Promise<TxObservation | null>;
  updateTxObservation(
    id: string,
    data: Partial<TxObservation>
  ): Promise<TxObservation>;
  listPendingTxObservations(): Promise<TxObservation[]>;

  createMagicLinkToken(
    data: Omit<MagicLinkToken, "id" | "createdAt">
  ): Promise<MagicLinkToken>;
  getMagicLinkToken(token: string): Promise<MagicLinkToken | null>;
  consumeMagicLinkToken(id: string): Promise<void>;

  createCustomer?(
    data: Omit<Customer, "id" | "createdAt" | "updatedAt">
  ): Promise<Customer>;
  getCustomer?(id: string): Promise<Customer | null>;
  getCustomerByEmail?(email: string): Promise<Customer | null>;
  updateCustomer?(id: string, data: Partial<Customer>): Promise<Customer>;

  // Subscription Plans
  createSubscriptionPlan?(plan: SubscriptionPlan): Promise<SubscriptionPlan>;
  getSubscriptionPlan?(planId: string): Promise<SubscriptionPlan | null>;
  updateSubscriptionPlan?(
    planId: string,
    updates: Partial<SubscriptionPlan>
  ): Promise<SubscriptionPlan>;
  upsertSubscriptionPlan?(
    plan: CreateSubscriptionPlanInput
  ): Promise<SubscriptionPlan>;
  listSubscriptionPlans?(activeOnly?: boolean): Promise<SubscriptionPlan[]>;

  // Subscriptions
  createSubscription?(
    subscription: Omit<Subscription, "id" | "createdAt" | "updatedAt">
  ): Promise<Subscription>;
  getSubscription?(subscriptionId: string): Promise<Subscription | null>;
  updateSubscription?(
    subscriptionId: string,
    updates: Partial<Subscription>
  ): Promise<Subscription>;
  listSubscriptions?(filters: SubscriptionFilters): Promise<Subscription[]>;

  // Subscription queries for automation
  getSubscriptionsNeedingRenewal?(
    beforeDate: Date
  ): Promise<Subscription[]>;
  getOverdueSubscriptions?(gracePeriodDays: number): Promise<Subscription[]>;

  // System metadata (for plan sync caching)
  getMetadata?(key: string): Promise<string | null>;
  setMetadata?(key: string, value: string): Promise<void>;
}
