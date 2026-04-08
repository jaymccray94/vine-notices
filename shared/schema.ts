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
