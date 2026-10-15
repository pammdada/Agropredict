import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { uuidv7 } from "../lib/uuid";

// Conventions: UUIDv7 keys, UTC timestamps, soft delete via deleted_at,
// org_id on every business table (tenant key).

const id = () => uuid("id").primaryKey().$defaultFn(uuidv7);
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const deletedAt = () => timestamp("deleted_at", { withTimezone: true });
const orgId = () =>
  uuid("org_id")
    .notNull()
    .references(() => organizations.id);

export type OrgRole = "ORG_ADMIN" | "ORG_ANALYST";
export type OrgStatus = "active" | "suspended";
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled" | "suspended";

// ───────────── Identity & tenancy ─────────────

export const organizations = pgTable("organizations", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  ruc: text("ruc"),
  status: text("status").$type<OrgStatus>().notNull().default("active"),
  suspendedReason: text("suspended_reason"),
  createdAt: createdAt(),
  deletedAt: deletedAt(),
});

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash"),
  isSuperadmin: boolean("is_superadmin").notNull().default(false),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  failedLoginCount: integer("failed_login_count").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: createdAt(),
  deletedAt: deletedAt(),
});

export const memberships = pgTable(
  "memberships",
  {
    id: id(),
    orgId: orgId(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    role: text("role").$type<OrgRole>().notNull(),
    createdAt: createdAt(),
    deletedAt: deletedAt(),
  },
  (t) => [uniqueIndex("memberships_org_user").on(t.orgId, t.userId)],
);

export const sessions = pgTable("sessions", {
  id: id(),
  tokenHash: text("token_hash").notNull().unique(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  activeOrgId: uuid("active_org_id").references(() => organizations.id),
  impersonatedOrgId: uuid("impersonated_org_id").references(() => organizations.id),
  impersonationReason: text("impersonation_reason"),
  authMethod: text("auth_method").notNull().default("password"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const passwordResets = pgTable("password_resets", {
  id: id(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const invitations = pgTable("invitations", {
  id: id(),
  orgId: orgId(),
  email: text("email").notNull(),
  role: text("role").$type<OrgRole>().notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  invitedBy: uuid("invited_by").references(() => users.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const ssoConfigs = pgTable("sso_configs", {
  id: id(),
  orgId: orgId().unique(),
  issuer: text("issuer").notNull(),
  clientId: text("client_id").notNull(),
  clientSecretHint: text("client_secret_hint").notNull(),
  allowedDomains: jsonb("allowed_domains").$type<string[]>().notNull().default([]),
  defaultRole: text("default_role").$type<OrgRole>().notNull().default("ORG_ANALYST"),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: createdAt(),
});

// One-time authorization codes issued by the simulated OAuth/OIDC provider.
export const oauthCodes = pgTable("oauth_codes", {
  id: id(),
  code: text("code").notNull().unique(),
  provider: text("provider").notNull(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  orgId: uuid("org_id").references(() => organizations.id),
  state: text("state").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    orgId: uuid("org_id").references(() => organizations.id),
    actorUserId: uuid("actor_user_id").references(() => users.id),
    action: text("action").notNull(),
    target: text("target"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("audit_log_org_created").on(t.orgId, t.createdAt)],
);

export const analyticsEvents = pgTable("analytics_events", {
  id: id(),
  orgId: uuid("org_id").references(() => organizations.id),
  userId: uuid("user_id").references(() => users.id),
  name: text("name").notNull(),
  props: jsonb("props").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: createdAt(),
});

// ───────────── Catalog (platform-wide) ─────────────

export const crops = pgTable("crops", {
  id: id(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  baseYieldTHa: doublePrecision("base_yield_t_ha").notNull(),
  active: boolean("active").notNull().default(true),
});

export const zones = pgTable("zones", {
  id: id(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  region: text("region").notNull(),
  active: boolean("active").notNull().default(true),
});

export const corridors = pgTable("corridors", {
  id: id(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  origin: text("origin").notNull(),
  destination: text("destination").notNull(),
  distanceKm: integer("distance_km").notNull(),
  transitHours: doublePrecision("transit_hours").notNull(),
  active: boolean("active").notNull().default(true),
});

// ───────────── Domain ─────────────

export const farms = pgTable("farms", {
  id: id(),
  orgId: orgId(),
  name: text("name").notNull(),
  cropId: uuid("crop_id")
    .notNull()
    .references(() => crops.id),
  zoneId: uuid("zone_id")
    .notNull()
    .references(() => zones.id),
  variety: text("variety"),
  hectares: doublePrecision("hectares").notNull(),
  historyYears: integer("history_years").notNull().default(0),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  createdAt: createdAt(),
  deletedAt: deletedAt(),
});

export type SimulationType = "YIELD" | "COLD_CHAIN";

export const simulations = pgTable(
  "simulations",
  {
    id: id(),
    orgId: orgId(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    farmId: uuid("farm_id")
      .notNull()
      .references(() => farms.id),
    type: text("type").$type<SimulationType>().notNull(),
    name: text("name").notNull(),
    input: jsonb("input").notNull(),
    result: jsonb("result").notNull(),
    modelVersion: text("model_version").notNull(),
    createdAt: createdAt(),
    deletedAt: deletedAt(),
  },
  (t) => [index("simulations_org_created").on(t.orgId, t.createdAt)],
);

export type DecisionStatus = "planned" | "in_progress" | "done" | "discarded";
export type Priority = "alta" | "media" | "baja";

export const decisions = pgTable("decisions", {
  id: id(),
  orgId: orgId(),
  simulationId: uuid("simulation_id").references(() => simulations.id),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull(),
  detail: text("detail"),
  priority: text("priority").$type<Priority>().notNull().default("media"),
  status: text("status").$type<DecisionStatus>().notNull().default("planned"),
  owner: text("owner"),
  dueDate: timestamp("due_date", { withTimezone: true }),
  notes: text("notes"),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: deletedAt(),
});

export type AlertMetric = "yield_drop_pct" | "cold_chain_loss_pct" | "shipment_temp_c";
export type Severity = "critica" | "alta" | "media";

export const alertRules = pgTable("alert_rules", {
  id: id(),
  orgId: orgId(),
  name: text("name").notNull(),
  metric: text("metric").$type<AlertMetric>().notNull(),
  threshold: doublePrecision("threshold").notNull(),
  severity: text("severity").$type<Severity>().notNull(),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: createdAt(),
});

export type AlertStatus = "open" | "acknowledged" | "resolved";

export const alerts = pgTable("alerts", {
  id: id(),
  orgId: orgId(),
  ruleId: uuid("rule_id").references(() => alertRules.id),
  farmId: uuid("farm_id").references(() => farms.id),
  simulationId: uuid("simulation_id").references(() => simulations.id),
  shipmentId: uuid("shipment_id"),
  severity: text("severity").$type<Severity>().notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  status: text("status").$type<AlertStatus>().notNull().default("open"),
  createdAt: createdAt(),
});

export type ShipmentStatus = "packing" | "in_transit" | "at_port" | "delivered";

export const shipments = pgTable("shipments", {
  id: id(),
  orgId: orgId(),
  corridorId: uuid("corridor_id")
    .notNull()
    .references(() => corridors.id),
  farmId: uuid("farm_id").references(() => farms.id),
  code: text("code").notNull(),
  container: text("container").notNull(),
  pallets: integer("pallets").notNull(),
  status: text("status").$type<ShipmentStatus>().notNull(),
  setpointC: doublePrecision("setpoint_c").notNull(),
  departedAt: timestamp("departed_at", { withTimezone: true }).notNull(),
  etaAt: timestamp("eta_at", { withTimezone: true }).notNull(),
  readings: jsonb("readings").$type<{ t: string; c: number }[]>().notNull().default([]),
  createdAt: createdAt(),
});

// ───────────── Billing ─────────────

export type Entitlements = {
  maxFarms: number; // -1 = unlimited
  maxHectares: number;
  maxUsers: number;
  maxSimulationsPerMonth: number;
  coldChain: boolean;
  scenarioCompare: boolean;
};

export const plans = pgTable("plans", {
  id: id(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  priceCents: integer("price_cents").notNull(), // PEN, IGV excluded
  entitlements: jsonb("entitlements").$type<Entitlements>().notNull(),
  highlighted: boolean("highlighted").notNull().default(false),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
});

export const subscriptions = pgTable("subscriptions", {
  id: id(),
  orgId: orgId().unique(),
  planId: uuid("plan_id")
    .notNull()
    .references(() => plans.id),
  status: text("status").$type<SubscriptionStatus>().notNull(),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }).notNull(),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type InvoiceStatus = "open" | "paid" | "void";

export const invoices = pgTable("invoices", {
  id: id(),
  orgId: orgId(),
  planId: uuid("plan_id")
    .notNull()
    .references(() => plans.id),
  number: text("number").notNull().unique(),
  subtotalCents: integer("subtotal_cents").notNull(),
  igvCents: integer("igv_cents").notNull(),
  totalCents: integer("total_cents").notNull(),
  status: text("status").$type<InvoiceStatus>().notNull(),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
});

export type PaymentStatus = "approved" | "rejected" | "pending";

export const payments = pgTable("payments", {
  id: id(),
  orgId: orgId(),
  invoiceId: uuid("invoice_id")
    .notNull()
    .references(() => invoices.id),
  provider: text("provider").notNull(),
  method: text("method").$type<"card" | "yape">().notNull(),
  amountCents: integer("amount_cents").notNull(),
  status: text("status").$type<PaymentStatus>().notNull(),
  providerRef: text("provider_ref").notNull().unique(),
  detail: text("detail"),
  failureReason: text("failure_reason"),
  createdAt: createdAt(),
});

export const paymentEvents = pgTable("payment_events", {
  id: id(),
  provider: text("provider").notNull(),
  eventId: text("event_id").notNull().unique(),
  type: text("type").notNull(),
  payload: jsonb("payload").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
});
