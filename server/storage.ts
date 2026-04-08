import crypto from "crypto";
import type {
  Association,
  InsertAssociation,
  User,
  SafeUser,
  InsertUser,
  UserAssociation,
  Notice,
  InsertNotice,
  Meeting,
  InsertMeeting,
} from "@shared/schema";

function uid(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

// ── Branding ──
export interface BrandingData {
  companyName: string;
  primaryColor: string;
  sidebarColor: string;
  accentColor: string;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  footerText?: string | null;
}

// ── CINC API Settings ──
export interface CincSettings {
  clientId: string;
  clientSecret: string;
  environment: "uat" | "production";
  scope: string;
  enabled: boolean;
  lastSyncAt: string | null;
  syncStatus: "idle" | "syncing" | "error" | "success";
  syncLog: Array<{ timestamp: string; message: string; type: "info" | "error" | "success" }>;
  lastSyncData?: {
    associations: number;
    vendors: number;
    workOrders: number;
  };
}

// ── Document type ──
export interface AssociationDocument {
  id: string;
  associationId: string;
  title: string;
  category: string;
  description: string | null;
  filename?: string;
  fileSize?: number;
  status: "current" | "archived" | "draft" | "expired";
  effectiveDate: string | null;
  expirationDate: string | null;
  retentionYears: number | null;
  isPublic: boolean;
  tags: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  organizationId: number;
}

// Florida HOA/POA document categories per F.S. 720.303 & 718.111
export const FLORIDA_DOCUMENT_CATEGORIES = [
  { id: "governing", label: "Governing Documents", description: "Declaration of Covenants, Articles of Incorporation, Bylaws, Amendments", retention: "Permanent", statute: "720.303(4)(a)2-5" },
  { id: "rules", label: "Rules & Regulations", description: "Current community rules and policies", retention: "Permanent", statute: "720.303(4)(a)5" },
  { id: "financial", label: "Financial Records", description: "Budgets, financial statements, tax returns, audits", retention: "7 years", statute: "720.303(4)(a)10" },
  { id: "meeting_minutes", label: "Meeting Minutes", description: "Board and membership meeting minutes", retention: "Permanent", statute: "720.303(4)(a)6" },
  { id: "insurance", label: "Insurance Policies", description: "Current insurance policies and certificates", retention: "Current + 7 years", statute: "720.303(4)(a)8" },
  { id: "contracts", label: "Contracts & Agreements", description: "Management agreements, leases, vendor contracts", retention: "Current + 7 years", statute: "720.303(4)(a)9" },
  { id: "plans_permits", label: "Plans, Permits & Warranties", description: "Construction plans, building permits, warranties", retention: "Permanent", statute: "720.303(4)(a)1" },
  { id: "elections", label: "Elections & Voting Records", description: "Ballots, proxies, sign-in sheets, voting records", retention: "1 year", statute: "720.303(4)(a)12" },
  { id: "assessments", label: "Assessment Records", description: "Assessment notices, lien records, estoppel certificates", retention: "7 years", statute: "720.303(4)" },
  { id: "correspondence", label: "Official Correspondence", description: "Board correspondence, legal notices, violation letters", retention: "7 years", statute: "720.303" },
  { id: "reserve_study", label: "Reserve Studies", description: "Reserve fund studies and structural integrity reports", retention: "15 years", statute: "718.111(12)(a)15" },
  { id: "disclosure", label: "Disclosure Documents", description: "Disclosure summaries, FAQ sheets", retention: "Current", statute: "720.401" },
  { id: "deeds_property", label: "Deeds & Property Records", description: "Deeds to common property, plats, surveys", retention: "Permanent", statute: "720.307(3)(a)" },
  { id: "other", label: "Other Documents", description: "Miscellaneous association records", retention: "7 years", statute: "" },
] as const;

export interface IStorage {
  // Auth
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;

  // Magic link codes
  createMagicCode(email: string): Promise<string>;
  verifyMagicCode(email: string, code: string): Promise<boolean>;

  // Users
  listUsers(): Promise<SafeUser[]>;
  createUser(input: InsertUser): Promise<SafeUser>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<SafeUser | null>;
  deleteUser(id: string): Promise<boolean>;

  // User ↔ Association
  getUserAssociations(userId: string): Promise<(UserAssociation & { associationName: string })[]>;
  setUserAssociations(userId: string, assignments: { associationId: string; permission: "manage" | "readonly" }[]): Promise<void>;
  canUserAccessAssociation(userId: string, associationId: string, requireManage?: boolean): Promise<boolean>;

  // Associations
  listAssociations(): Promise<Association[]>;
  getAssociation(id: string): Promise<Association | undefined>;
  getAssociationBySlug(slug: string): Promise<Association | undefined>;
  createAssociation(input: InsertAssociation): Promise<Association>;
  updateAssociation(id: string, data: Partial<InsertAssociation>): Promise<Association | null>;
  deleteAssociation(id: string): Promise<boolean>;

  // Notices
  listNotices(associationId: string): Promise<Notice[]>;
  getNotice(id: string): Promise<Notice | undefined>;
  createNotice(input: InsertNotice, createdBy: string): Promise<Notice>;
  updateNotice(id: string, data: Partial<InsertNotice>): Promise<Notice | null>;
  deleteNotice(id: string): Promise<boolean>;
  setNoticePdf(noticeId: string, filename: string | null): Promise<void>;

  // Meetings
  listMeetings(associationId: string): Promise<Meeting[]>;
  getMeeting(id: string): Promise<Meeting | undefined>;
  createMeeting(input: InsertMeeting, createdBy: string): Promise<Meeting>;
  updateMeeting(id: string, data: Partial<InsertMeeting>): Promise<Meeting | null>;
  deleteMeeting(id: string): Promise<boolean>;

  // Documents
  listDocuments(associationId: string): Promise<AssociationDocument[]>;
  listAllDocuments(): Promise<AssociationDocument[]>;
  getDocument(id: string): Promise<AssociationDocument | undefined>;
  createDocument(input: Omit<AssociationDocument, "id" | "createdAt" | "updatedAt">, createdBy: string): Promise<AssociationDocument>;
  updateDocument(id: string, data: Partial<AssociationDocument>): Promise<AssociationDocument | null>;
  deleteDocument(id: string): Promise<boolean>;
  setDocumentFile(docId: string, filename: string | null): Promise<void>;

  // CINC API Settings
  getCincSettings(): Promise<CincSettings>;
  updateCincSettings(data: Partial<CincSettings>): Promise<CincSettings>;
  addCincSyncLog(message: string, type: "info" | "error" | "success"): Promise<void>;

  // Branding
  getBranding(): Promise<BrandingData>;
  updateBranding(data: Partial<BrandingData>): Promise<BrandingData>;
}

export class MemStorage implements IStorage {
  private users = new Map<string, User>();
  private associations = new Map<string, Association>();
  private userAssociations: UserAssociation[] = [];
  private notices = new Map<string, Notice>();
  private meetings = new Map<string, Meeting>();
  private magicCodes = new Map<string, { code: string; expiresAt: number }>();
  private documents = new Map<string, AssociationDocument>();
  private cincSettings: CincSettings = {
    clientId: "",
    clientSecret: "",
    environment: "uat",
    scope: "cincapi.all",
    enabled: false,
    lastSyncAt: null,
    syncStatus: "idle",
    syncLog: [],
  };
  private branding: BrandingData = {
    companyName: "Vine Management",
    primaryColor: "#317C3C",
    sidebarColor: "#1B3E1E",
    accentColor: "#8BC53F",
  };

  constructor() {
    // Seed super admin
    const adminId = uid();
    this.users.set(adminId, {
      id: adminId,
      email: "admin@vinemgt.com",
      name: "Vine Admin",
      role: "super_admin",
      active: true,
      createdAt: now(),
      organizationId: 1,
    });

    // Seed Jay
    const jayId = uid();
    this.users.set(jayId, {
      id: jayId,
      email: "jay@vinemgt.com",
      name: "Jay",
      role: "super_admin",
      active: true,
      createdAt: now(),
      organizationId: 1,
    });

    // Seed RSPOA
    const rspoaId = uid();
    this.associations.set(rspoaId, {
      id: rspoaId,
      name: "Rainbow Springs POA",
      slug: "rainbow-springs",
      primaryColor: "#317C3C",
      accentColor: "#8BC53F",
      darkColor: "#1B3E1E",
      createdAt: now(),
      organizationId: 1,
    });

    // Seed notices
    const demoNotices = [
      { date: "2025-02-18", title: "Board of Directors Meeting", type: "Board Meeting", description: "Regular board meeting to discuss community matters." },
      { date: "2025-03-04", title: "Board of Directors Meeting", type: "Board Meeting", description: "Monthly board meeting." },
      { date: "2025-01-14", title: "Board of Directors Meeting", type: "Board Meeting", description: "Regular board meeting." },
      { date: "2025-02-12", title: "Budget Meeting Notice", type: "Budget", description: "Annual budget review and approval meeting." },
      { date: "2025-01-02", title: "Assessment Notice 2025", type: "Assessment", description: "Annual assessment notice for 2025." },
    ];
    for (const n of demoNotices) {
      const nid = uid();
      this.notices.set(nid, {
        id: nid,
        associationId: rspoaId,
        ...n,
        postedDate: now(),
        createdBy: adminId,
        organizationId: 1,
      });
    }

    // Seed meetings
    const demoMeetings = [
      { date: "2025-03-04", title: "Board of Directors Meeting", description: "Regular monthly board meeting.", videoUrl: "https://www.youtube.com/watch?v=example1", agendaUrl: "", minutesUrl: "" },
      { date: "2025-02-18", title: "Board of Directors Meeting", description: "Monthly board meeting.", videoUrl: "https://www.youtube.com/watch?v=example2", agendaUrl: "https://example.com/agenda-feb.pdf", minutesUrl: "https://example.com/minutes-feb.pdf" },
      { date: "2025-01-14", title: "Annual Members Meeting", description: "Annual election and budget review.", videoUrl: "", agendaUrl: "https://example.com/agenda-annual.pdf", minutesUrl: "" },
    ];
    for (const m of demoMeetings) {
      const mid = uid();
      this.meetings.set(mid, {
        id: mid,
        associationId: rspoaId,
        ...m,
        createdBy: adminId,
        createdAt: now(),
        organizationId: 1,
      });
    }

    // Seed documents
    const demoDocuments = [
      { title: "Declaration of Covenants", category: "governing", description: "Original declaration of covenants, conditions, and restrictions", status: "current" as const, effectiveDate: "2020-01-01", expirationDate: null, retentionYears: null, isPublic: true, tags: ["covenant", "governing"] },
      { title: "2024 Annual Budget", category: "financial", description: "Approved annual budget for fiscal year 2024", status: "current" as const, effectiveDate: "2024-01-01", expirationDate: "2024-12-31", retentionYears: 7, isPublic: false, tags: ["budget", "2024"] },
      { title: "Board Meeting Minutes - Jan 2025", category: "meeting_minutes", description: "Minutes from January 2025 board meeting", status: "current" as const, effectiveDate: "2025-01-14", expirationDate: null, retentionYears: null, isPublic: true, tags: ["minutes", "board"] },
    ];
    for (const d of demoDocuments) {
      const did = uid();
      this.documents.set(did, {
        id: did,
        associationId: rspoaId,
        ...d,
        createdBy: adminId,
        createdAt: now(),
        updatedAt: now(),
        organizationId: 1,
      });
    }
  }

  // ── Auth ──
  async getUserByEmail(email: string): Promise<User | undefined> {
    return [...this.users.values()].find((u) => u.email.toLowerCase() === email.toLowerCase());
  }
  async getUserById(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  // ── Magic Codes ──
  async createMagicCode(email: string): Promise<string> {
    const code = Math.random().toString().slice(2, 8).padStart(6, "0");
    this.magicCodes.set(email, { code, expiresAt: Date.now() + 24 * 60 * 60 * 1000 });
    return code;
  }
  async verifyMagicCode(email: string, code: string): Promise<boolean> {
    const entry = this.magicCodes.get(email);
    if (!entry) return false;
    if (entry.code !== code || entry.expiresAt < Date.now()) return false;
    this.magicCodes.delete(email);
    return true;
  }

  // ── Users ──
  async listUsers(): Promise<SafeUser[]> {
    return [...this.users.values()].map(({ passwordHash, ...u }) => u as SafeUser);
  }
  async createUser(input: InsertUser): Promise<SafeUser> {
    const id = uid();
    const user: User = { id, ...input, active: true, createdAt: now(), organizationId: 1 };
    this.users.set(id, user);
    const { passwordHash, ...safe } = user;
    return safe as SafeUser;
  }
  async updateUser(id: string, data: Partial<InsertUser>): Promise<SafeUser | null> {
    const user = this.users.get(id);
    if (!user) return null;
    const updated = { ...user, ...data };
    this.users.set(id, updated);
    const { passwordHash, ...safe } = updated;
    return safe as SafeUser;
  }
  async deleteUser(id: string): Promise<boolean> {
    return this.users.delete(id);
  }

  // ── User ↔ Association ──
  async getUserAssociations(userId: string): Promise<(UserAssociation & { associationName: string })[]> {
    const user = this.users.get(userId);
    if (user?.role === "super_admin") {
      return [...this.associations.values()].map((a) => ({
        userId,
        associationId: a.id,
        permission: "manage" as const,
        associationName: a.name,
      }));
    }
    return this.userAssociations
      .filter((ua) => ua.userId === userId)
      .map((ua) => ({
        ...ua,
        associationName: this.associations.get(ua.associationId)?.name || "",
      }));
  }
  async setUserAssociations(userId: string, assignments: { associationId: string; permission: "manage" | "readonly" }[]): Promise<void> {
    this.userAssociations = this.userAssociations.filter((ua) => ua.userId !== userId);
    for (const a of assignments) {
      this.userAssociations.push({ userId, associationId: a.associationId, permission: a.permission });
    }
  }
  async canUserAccessAssociation(userId: string, associationId: string, requireManage = false): Promise<boolean> {
    const user = this.users.get(userId);
    if (!user) return false;
    if (user.role === "super_admin") return true;
    const ua = this.userAssociations.find((ua) => ua.userId === userId && ua.associationId === associationId);
    if (!ua) return false;
    if (requireManage) return ua.permission === "manage";
    return true;
  }

  // ── Associations ──
  async listAssociations(): Promise<Association[]> {
    return [...this.associations.values()];
  }
  async getAssociation(id: string): Promise<Association | undefined> {
    return this.associations.get(id);
  }
  async getAssociationBySlug(slug: string): Promise<Association | undefined> {
    return [...this.associations.values()].find((a) => a.slug === slug);
  }
  async createAssociation(input: InsertAssociation): Promise<Association> {
    const id = uid();
    const assoc: Association = { id, ...input, createdAt: now() };
    this.associations.set(id, assoc);
    return assoc;
  }
  async updateAssociation(id: string, data: Partial<InsertAssociation>): Promise<Association | null> {
    const assoc = this.associations.get(id);
    if (!assoc) return null;
    const updated = { ...assoc, ...data };
    this.associations.set(id, updated);
    return updated;
  }
  async deleteAssociation(id: string): Promise<boolean> {
    return this.associations.delete(id);
  }

  // ── Notices ──
  async listNotices(associationId: string): Promise<Notice[]> {
    return [...this.notices.values()]
      .filter((n) => n.associationId === associationId)
      .sort((a, b) => b.date.localeCompare(a.date));
  }
  async getNotice(id: string): Promise<Notice | undefined> {
    return this.notices.get(id);
  }
  async createNotice(input: InsertNotice, createdBy: string): Promise<Notice> {
    const id = uid();
    const notice: Notice = { id, ...input, postedDate: now(), createdBy, organizationId: 1 };
    this.notices.set(id, notice);
    return notice;
  }
  async updateNotice(id: string, data: Partial<InsertNotice>): Promise<Notice | null> {
    const existing = this.notices.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...data };
    this.notices.set(id, updated);
    return updated;
  }
  async deleteNotice(id: string): Promise<boolean> {
    return this.notices.delete(id);
  }
  async setNoticePdf(noticeId: string, filename: string | null): Promise<void> {
    const n = this.notices.get(noticeId);
    if (n) {
      n.pdfFilename = filename || undefined;
      this.notices.set(noticeId, n);
    }
  }

  // ── Meetings ──
  async listMeetings(associationId: string): Promise<Meeting[]> {
    return [...this.meetings.values()]
      .filter((m) => m.associationId === associationId)
      .sort((a, b) => b.date.localeCompare(a.date));
  }
  async getMeeting(id: string): Promise<Meeting | undefined> {
    return this.meetings.get(id);
  }
  async createMeeting(input: InsertMeeting, createdBy: string): Promise<Meeting> {
    const id = uid();
    const meeting: Meeting = { id, ...input, createdBy, createdAt: now(), organizationId: 1 };
    this.meetings.set(id, meeting);
    return meeting;
  }
  async updateMeeting(id: string, data: Partial<InsertMeeting>): Promise<Meeting | null> {
    const existing = this.meetings.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...data };
    this.meetings.set(id, updated);
    return updated;
  }
  async deleteMeeting(id: string): Promise<boolean> {
    return this.meetings.delete(id);
  }

  // ── Documents ──
  async listDocuments(associationId: string): Promise<AssociationDocument[]> {
    return [...this.documents.values()]
      .filter((d) => d.associationId === associationId)
      .sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title));
  }
  async listAllDocuments(): Promise<AssociationDocument[]> {
    return [...this.documents.values()]
      .sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title));
  }
  async getDocument(id: string): Promise<AssociationDocument | undefined> {
    return this.documents.get(id);
  }
  async createDocument(input: Omit<AssociationDocument, "id" | "createdAt" | "updatedAt">, createdBy: string): Promise<AssociationDocument> {
    const id = uid();
    const doc: AssociationDocument = { id, ...input, createdBy, createdAt: now(), updatedAt: now() };
    this.documents.set(id, doc);
    return doc;
  }
  async updateDocument(id: string, data: Partial<AssociationDocument>): Promise<AssociationDocument | null> {
    const existing = this.documents.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...data, updatedAt: now() };
    this.documents.set(id, updated);
    return updated;
  }
  async deleteDocument(id: string): Promise<boolean> {
    return this.documents.delete(id);
  }
  async setDocumentFile(docId: string, filename: string | null): Promise<void> {
    const d = this.documents.get(docId);
    if (d) {
      d.filename = filename || undefined;
      d.updatedAt = now();
      this.documents.set(docId, d);
    }
  }

  // ── CINC Settings ──
  async getCincSettings(): Promise<CincSettings> {
    return { ...this.cincSettings };
  }
  async updateCincSettings(data: Partial<CincSettings>): Promise<CincSettings> {
    this.cincSettings = { ...this.cincSettings, ...data };
    return { ...this.cincSettings };
  }
  async addCincSyncLog(message: string, type: "info" | "error" | "success"): Promise<void> {
    this.cincSettings.syncLog.unshift({ timestamp: now(), message, type });
    if (this.cincSettings.syncLog.length > 50) {
      this.cincSettings.syncLog = this.cincSettings.syncLog.slice(0, 50);
    }
  }

  // ── Branding ──
  async getBranding(): Promise<BrandingData> {
    return { ...this.branding };
  }
  async updateBranding(data: Partial<BrandingData>): Promise<BrandingData> {
    this.branding = { ...this.branding, ...data };
    return { ...this.branding };
  }
}

export let storage: IStorage = new MemStorage();

export function setStorage(s: IStorage) {
  storage = s;
}
