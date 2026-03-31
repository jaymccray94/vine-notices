import { pgTable, text, integer, real, boolean, timestamp, jsonb, primaryKey } from "drizzle-orm/pg-core";

// ── Users ──
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: text("role").notNull().default("staff"),
  createdAt: text("created_at").notNull(),
});

// ── Associations ──
export const associations = pgTable("associations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  primaryColor: text("primary_color").notNull().default("#317C3C"),
  accentColor: text("accent_color").notNull().default("#8BC53F"),
  darkColor: text("dark_color").notNull().default("#1B3E1E"),
  createdAt: text("created_at").notNull(),
});

// ── User ↔ Association ──
export const userAssociations = pgTable("user_associations", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  associationId: text("association_id").notNull().references(() => associations.id, { onDelete: "cascade" }),
  permission: text("permission").notNull().default("readonly"),
}, (t) => [primaryKey({ columns: [t.userId, t.associationId] })]);

// ── Notices ──
export const notices = pgTable("notices", {
  id: text("id").primaryKey(),
  associationId: text("association_id").notNull().references(() => associations.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  title: text("title").notNull(),
  type: text("type").notNull(),
  description: text("description"),
  pdfFilename: text("pdf_filename"),
  meetingUrl: text("meeting_url"),
  postedDate: text("posted_date").notNull(),
  createdBy: text("created_by").notNull(),
});

// ── Meetings ──
export const meetings = pgTable("meetings", {
  id: text("id").primaryKey(),
  associationId: text("association_id").notNull().references(() => associations.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  videoUrl: text("video_url"),
  agendaUrl: text("agenda_url"),
  minutesUrl: text("minutes_url"),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
});

// ── Tickets ──
export const tickets = pgTable("tickets", {
  id: text("id").primaryKey(),
  associationId: text("association_id").notNull().references(() => associations.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("open"),
  priority: text("priority").notNull().default("medium"),
  assignee: text("assignee"),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
});

// ── Insurance Policies ──
export const insurancePolicies = pgTable("insurance_policies", {
  id: text("id").primaryKey(),
  associationId: text("association_id").notNull().references(() => associations.id, { onDelete: "cascade" }),
  carrier: text("carrier").notNull(),
  policyNumber: text("policy_number").notNull(),
  coverageType: text("coverage_type").notNull(),
  premium: real("premium"),
  effectiveDate: text("effective_date").notNull(),
  expirationDate: text("expiration_date").notNull(),
  notes: text("notes"),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
});

// ── Mailing Requests ──
export const mailingRequests = pgTable("mailing_requests", {
  id: text("id").primaryKey(),
  associationId: text("association_id").notNull().references(() => associations.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  recipientCount: integer("recipient_count"),
  mailingType: text("mailing_type").notNull(),
  status: text("status").notNull().default("draft"),
  requestedDate: text("requested_date").notNull(),
  targetMailDate: text("target_mail_date"),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
});

// ── Onboarding Checklists ──
export const onboardingChecklists = pgTable("onboarding_checklists", {
  id: text("id").primaryKey(),
  associationId: text("association_id").notNull().references(() => associations.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  items: jsonb("items").notNull().default([]),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
});

// ── Accounting Items ──
export const accountingItems = pgTable("accounting_items", {
  id: text("id").primaryKey(),
  associationId: text("association_id").notNull().references(() => associations.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  type: text("type").notNull(),
  amount: real("amount").notNull(),
  amountPaid: real("amount_paid").notNull().default(0),
  status: text("status").notNull().default("outstanding"),
  dueDate: text("due_date").notNull(),
  unit: text("unit"),
  notes: text("notes"),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
});

// ── Invoices ──
export const invoices = pgTable("invoices", {
  id: text("id").primaryKey(),
  associationId: text("association_id").notNull().references(() => associations.id, { onDelete: "cascade" }),
  vendor: text("vendor").notNull(),
  invoiceNumber: text("invoice_number"),
  invoiceDate: text("invoice_date").notNull(),
  totalAmount: real("total_amount").notNull(),
  status: text("status").notNull().default("uploaded"),
  lineItems: jsonb("line_items").notNull().default([]),
  notes: text("notes"),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
});

// ── Vendors ──
export const vendors = pgTable("vendors", {
  id: text("id").primaryKey(),
  associationId: text("association_id").notNull().references(() => associations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  contactName: text("contact_name"),
  phone: text("phone"),
  email: text("email"),
  category: text("category").notNull().default("General"),
  status: text("status").notNull().default("active"),
  insuranceExpiry: text("insurance_expiry"),
  notes: text("notes"),
  cincVendorId: text("cinc_vendor_id"),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
});

// ── Documents ──
export const documents = pgTable("documents", {
  id: text("id").primaryKey(),
  associationId: text("association_id").notNull().references(() => associations.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  filename: text("filename"),
  fileSize: integer("file_size"),
  status: text("status").notNull().default("current"),
  effectiveDate: text("effective_date"),
  expirationDate: text("expiration_date"),
  retentionYears: integer("retention_years"),
  isPublic: boolean("is_public").notNull().default(false),
  tags: jsonb("tags").notNull().default([]),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// ── Magic Codes ──
export const magicCodes = pgTable("magic_codes", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  code: text("code").notNull(),
  expiresAt: integer("expires_at").notNull(),
  used: boolean("used").notNull().default(false),
});

// ── CINC Settings (singleton) ──
export const cincSettings = pgTable("cinc_settings", {
  id: text("id").primaryKey().default("singleton"),
  clientId: text("client_id").notNull().default(""),
  clientSecret: text("client_secret").notNull().default(""),
  environment: text("environment").notNull().default("uat"),
  scope: text("scope").notNull().default("cincapi.all"),
  enabled: boolean("enabled").notNull().default(false),
  lastSyncAt: text("last_sync_at"),
  syncStatus: text("sync_status").notNull().default("idle"),
  syncLog: jsonb("sync_log").notNull().default([]),
  lastSyncData: jsonb("last_sync_data"),
});
