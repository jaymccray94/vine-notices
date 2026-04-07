import { z } from "zod";

// ── Roles ──
export const ROLES = ["super_admin", "association_admin", "staff"] as const;
export type Role = (typeof ROLES)[number];
export type UserRole = Role;

// ── Role Hierarchy (for permission checks) ──
export const ROLE_HIERARCHY: Record<string, number> = {
  super_admin: 3,
  association_admin: 2,
  staff: 1,
};

// ── Organization ──
export const organizationSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
  domain: z.string().optional(),
  logoUrl: z.string().optional(),
  plan: z.string().default("free"),
  settings: z.string().optional(),
  createdAt: z.string(),
  customDomain: z.string().optional(),
  domainVerified: z.boolean().default(false),
  subdomain: z.string().optional(),
  onboardingCompleted: z.boolean().default(false),
  maxUsers: z.number().default(50),
});
export type Organization = z.infer<typeof organizationSchema>;
export const insertOrganizationSchema = organizationSchema.omit({ id: true, createdAt: true });
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;

// ── Membership ──
export const membershipSchema = z.object({
  id: z.number(),
  userId: z.string(),
  organizationId: z.number(),
  role: z.string().default("staff"),
  isActive: z.boolean().default(true),
  createdAt: z.string(),
});
export type Membership = z.infer<typeof membershipSchema>;

// ── Notice Types ──
export const NOTICE_TYPES = [
  "Board Meeting",
  "Annual Meeting",
  "Budget",
  "Election",
  "Assessment",
  "Amendment",
  "Rule Change",
  "Recall",
  "Reserve Study",
  "Financial Report",
  "Lien/Foreclosure",
  "Event",
  "General",
] as const;

// ── Association ──
export const associationSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  primaryColor: z.string().default("#317C3C"),
  accentColor: z.string().default("#8BC53F"),
  darkColor: z.string().default("#1B3E1E"),
  createdAt: z.string(),
  organizationId: z.number().default(1),
});
export type Association = z.infer<typeof associationSchema>;
export const insertAssociationSchema = associationSchema.omit({ id: true, createdAt: true });
export type InsertAssociation = z.infer<typeof insertAssociationSchema>;

// ── User ──
export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: z.enum(ROLES),
  active: z.boolean().default(true),
  picture: z.string().optional(),
  passwordHash: z.string().optional(),
  authMethod: z.string().default("magic_link"),
  createdAt: z.string(),
  organizationId: z.number().default(1),
});
export type User = z.infer<typeof userSchema>;
export const insertUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(ROLES),
});
export type InsertUser = z.infer<typeof insertUserSchema>;

// ── User ↔ Association assignment ──
export const userAssociationSchema = z.object({
  userId: z.string(),
  associationId: z.string(),
  permission: z.enum(["manage", "readonly"]),
});
export type UserAssociation = z.infer<typeof userAssociationSchema>;

// ── Notice ──
export const noticeSchema = z.object({
  id: z.string(),
  associationId: z.string(),
  date: z.string(),
  title: z.string(),
  type: z.string(),
  description: z.string().optional(),
  pdfFilename: z.string().optional(),
  meetingUrl: z.string().optional(),
  postedDate: z.string(),
  createdBy: z.string(),
  organizationId: z.number().default(1),
});
export type Notice = z.infer<typeof noticeSchema>;
export const insertNoticeSchema = z.object({
  associationId: z.string(),
  date: z.string(),
  title: z.string().min(1),
  type: z.string(),
  description: z.string().optional(),
  meetingUrl: z.string().optional(),
});
export type InsertNotice = z.infer<typeof insertNoticeSchema>;

// ── Public notice (what the embed page sees) ──
export const publicNoticeSchema = z.object({
  id: z.string(),
  date: z.string(),
  title: z.string(),
  type: z.string(),
  description: z.string().optional(),
  pdfUrl: z.string().optional(),
  meetingUrl: z.string().optional(),
  postedDate: z.string(),
});
export type PublicNotice = z.infer<typeof publicNoticeSchema>;

// ── Magic link auth ──
export const magicLinkRequestSchema = z.object({
  email: z.string().email(),
});
export type MagicLinkRequest = z.infer<typeof magicLinkRequestSchema>;

export const magicLinkVerifySchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});
export type MagicLinkVerify = z.infer<typeof magicLinkVerifySchema>;

// ── Meeting ──
export const meetingSchema = z.object({
  id: z.string(),
  associationId: z.string(),
  date: z.string(),
  title: z.string(),
  description: z.string().optional(),
  videoUrl: z.string().optional(),
  agendaUrl: z.string().optional(),
  minutesUrl: z.string().optional(),
  createdBy: z.string(),
  createdAt: z.string(),
  organizationId: z.number().default(1),
});
export type Meeting = z.infer<typeof meetingSchema>;
export const insertMeetingSchema = z.object({
  associationId: z.string(),
  date: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  videoUrl: z.string().optional(),
  agendaUrl: z.string().optional(),
  minutesUrl: z.string().optional(),
});
export type InsertMeeting = z.infer<typeof insertMeetingSchema>;

// ── Public meeting (what the embed page sees) ──
export const publicMeetingSchema = z.object({
  id: z.string(),
  date: z.string(),
  title: z.string(),
  description: z.string().optional(),
  videoUrl: z.string().optional(),
  agendaUrl: z.string().optional(),
  minutesUrl: z.string().optional(),
  createdAt: z.string(),
});
export type PublicMeeting = z.infer<typeof publicMeetingSchema>;

// ── Ticket ──
export const TICKET_STATUSES = ["open", "in_progress", "review", "done"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export const TICKET_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const ticketSchema = z.object({
  id: z.string(),
  associationId: z.string(),
  title: z.string(),
  description: z.string().optional(),
  status: z.enum(TICKET_STATUSES),
  priority: z.enum(TICKET_PRIORITIES),
  assignee: z.string().optional(),
  createdBy: z.string(),
  createdAt: z.string(),
  organizationId: z.number().default(1),
});
export type Ticket = z.infer<typeof ticketSchema>;
export const insertTicketSchema = z.object({
  associationId: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(TICKET_STATUSES).default("open"),
  priority: z.enum(TICKET_PRIORITIES).default("medium"),
  assignee: z.string().optional(),
});
export type InsertTicket = z.infer<typeof insertTicketSchema>;

// ── Insurance Policy ──
export const COVERAGE_TYPES = ["General Liability", "Property", "D&O", "Workers Comp", "Umbrella", "Fidelity Bond", "Flood", "Wind", "Auto", "Other"] as const;

export const insurancePolicySchema = z.object({
  id: z.string(),
  associationId: z.string(),
  carrier: z.string(),
  policyNumber: z.string(),
  coverageType: z.string(),
  premium: z.number().optional(),
  effectiveDate: z.string(),
  expirationDate: z.string(),
  notes: z.string().optional(),
  createdBy: z.string(),
  createdAt: z.string(),
  organizationId: z.number().default(1),
});
export type InsurancePolicy = z.infer<typeof insurancePolicySchema>;
export const insertInsurancePolicySchema = z.object({
  associationId: z.string(),
  carrier: z.string().min(1),
  policyNumber: z.string().min(1),
  coverageType: z.string().min(1),
  premium: z.number().optional(),
  effectiveDate: z.string(),
  expirationDate: z.string(),
  notes: z.string().optional(),
});
export type InsertInsurancePolicy = z.infer<typeof insertInsurancePolicySchema>;

// ── Mailing Request ──
export const MAILING_STATUSES = ["draft", "pending_approval", "approved", "in_production", "mailed", "cancelled"] as const;
export type MailingStatus = (typeof MAILING_STATUSES)[number];

export const mailingRequestSchema = z.object({
  id: z.string(),
  associationId: z.string(),
  title: z.string(),
  description: z.string().optional(),
  recipientCount: z.number().optional(),
  mailingType: z.string(),
  status: z.enum(MAILING_STATUSES),
  requestedDate: z.string(),
  targetMailDate: z.string().optional(),
  createdBy: z.string(),
  createdAt: z.string(),
  organizationId: z.number().default(1),
});
export type MailingRequest = z.infer<typeof mailingRequestSchema>;
export const insertMailingRequestSchema = z.object({
  associationId: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  recipientCount: z.number().optional(),
  mailingType: z.string().min(1),
  status: z.enum(MAILING_STATUSES).default("draft"),
  targetMailDate: z.string().optional(),
});
export type InsertMailingRequest = z.infer<typeof insertMailingRequestSchema>;

// ── Onboarding Checklist ──
export const onboardingChecklistSchema = z.object({
  id: z.string(),
  associationId: z.string(),
  title: z.string(),
  items: z.array(z.object({
    id: z.string(),
    label: z.string(),
    completed: z.boolean(),
    completedAt: z.string().optional(),
    notes: z.string().optional(),
  })),
  createdBy: z.string(),
  createdAt: z.string(),
  organizationId: z.number().default(1),
});
export type OnboardingChecklist = z.infer<typeof onboardingChecklistSchema>;
export type OnboardingItem = OnboardingChecklist["items"][number];
export const insertOnboardingChecklistSchema = z.object({
  associationId: z.string(),
  title: z.string().min(1),
  items: z.array(z.object({
    label: z.string().min(1),
  })).optional(),
});
export type InsertOnboardingChecklist = z.infer<typeof insertOnboardingChecklistSchema>;

// ── Accounting Item ──
export const ACCOUNTING_STATUSES = ["outstanding", "partial", "paid", "overdue", "written_off"] as const;
export type AccountingStatus = (typeof ACCOUNTING_STATUSES)[number];
export const ACCOUNTING_TYPES = ["Assessment", "Special Assessment", "Late Fee", "Violation Fine", "Legal Fee", "Vendor Invoice", "Insurance", "Other"] as const;

export const accountingItemSchema = z.object({
  id: z.string(),
  associationId: z.string(),
  description: z.string(),
  type: z.string(),
  amount: z.number(),
  amountPaid: z.number().default(0),
  status: z.enum(ACCOUNTING_STATUSES),
  dueDate: z.string(),
  unit: z.string().optional(),
  notes: z.string().optional(),
  createdBy: z.string(),
  createdAt: z.string(),
  organizationId: z.number().default(1),
});
export type AccountingItem = z.infer<typeof accountingItemSchema>;
export const insertAccountingItemSchema = z.object({
  associationId: z.string(),
  description: z.string().min(1),
  type: z.string().min(1),
  amount: z.number().min(0),
  amountPaid: z.number().default(0),
  status: z.enum(ACCOUNTING_STATUSES).default("outstanding"),
  dueDate: z.string(),
  unit: z.string().optional(),
  notes: z.string().optional(),
});
export type InsertAccountingItem = z.infer<typeof insertAccountingItemSchema>;

// ── Invoice (AI Splitter) ──
export const INVOICE_STATUSES = ["uploaded", "processing", "review", "approved", "rejected"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const invoiceLineItemSchema = z.object({
  id: z.string(),
  description: z.string(),
  amount: z.number(),
  category: z.string().optional(),
  glCode: z.string().optional(),
});
export type InvoiceLineItem = z.infer<typeof invoiceLineItemSchema>;

export const invoiceSchema = z.object({
  id: z.string(),
  associationId: z.string(),
  vendor: z.string(),
  invoiceNumber: z.string().optional(),
  invoiceDate: z.string(),
  totalAmount: z.number(),
  status: z.enum(INVOICE_STATUSES),
  lineItems: z.array(invoiceLineItemSchema),
  notes: z.string().optional(),
  createdBy: z.string(),
  createdAt: z.string(),
  organizationId: z.number().default(1),
});
export type Invoice = z.infer<typeof invoiceSchema>;
export const insertInvoiceSchema = z.object({
  associationId: z.string(),
  vendor: z.string().min(1),
  invoiceNumber: z.string().optional(),
  invoiceDate: z.string(),
  totalAmount: z.number().min(0),
  lineItems: z.array(z.object({
    description: z.string().min(1),
    amount: z.number(),
    category: z.string().optional(),
    glCode: z.string().optional(),
  })).optional(),
  notes: z.string().optional(),
});
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;

// ── Branding Settings ──
export const brandingSettingsSchema = z.object({
  id: z.number(),
  logoUrl: z.string().optional(),
  faviconUrl: z.string().optional(),
  companyName: z.string().default("Vine Management"),
  footerText: z.string().optional(),
  primaryColor: z.string().default("#317C3C"),
  sidebarColor: z.string().default("#1B3E1E"),
  accentColor: z.string().default("#8BC53F"),
  organizationId: z.number().default(1),
});
export type BrandingSettings = z.infer<typeof brandingSettingsSchema>;

// ── Safe user (public-facing) ──
export type SafeUser = User & {
  associations?: (UserAssociation & { associationName?: string })[];
};
