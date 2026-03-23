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
  Ticket,
  InsertTicket,
  InsurancePolicy,
  InsertInsurancePolicy,
  MailingRequest,
  InsertMailingRequest,
  OnboardingChecklist,
  InsertOnboardingChecklist,
  AccountingItem,
  InsertAccountingItem,
  Invoice,
  InsertInvoice,
} from "@shared/schema";

function uid(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
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

// ── Vendor (maps to CINC VendorInfo) ──
export interface Vendor {
  id: string;
  associationId: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  category: string;
  status: "active" | "inactive";
  insuranceExpiry: string | null;
  notes: string | null;
  cincVendorId: string | null;
  createdBy: string;
  createdAt: string;
}

export interface IStorage {
  // Auth
  getUserByEmail(email: string): User | undefined;
  getUserById(id: string): User | undefined;

  // Magic link codes
  createMagicCode(email: string): string;
  verifyMagicCode(email: string, code: string): boolean;

  // Users
  listUsers(): SafeUser[];
  createUser(input: InsertUser): SafeUser;
  updateUser(id: string, data: Partial<InsertUser>): SafeUser | null;
  deleteUser(id: string): boolean;

  // User ↔ Association
  getUserAssociations(userId: string): (UserAssociation & { associationName: string })[];
  setUserAssociations(userId: string, assignments: { associationId: string; permission: "manage" | "readonly" }[]): void;
  canUserAccessAssociation(userId: string, associationId: string, requireManage?: boolean): boolean;

  // Associations
  listAssociations(): Association[];
  getAssociation(id: string): Association | undefined;
  getAssociationBySlug(slug: string): Association | undefined;
  createAssociation(input: InsertAssociation): Association;
  updateAssociation(id: string, data: Partial<InsertAssociation>): Association | null;
  deleteAssociation(id: string): boolean;

  // Notices
  listNotices(associationId: string): Notice[];
  getNotice(id: string): Notice | undefined;
  createNotice(input: InsertNotice, createdBy: string): Notice;
  updateNotice(id: string, data: Partial<InsertNotice>): Notice | null;
  deleteNotice(id: string): boolean;
  setNoticePdf(noticeId: string, filename: string | null): void;

  // Meetings
  listMeetings(associationId: string): Meeting[];
  getMeeting(id: string): Meeting | undefined;
  createMeeting(input: InsertMeeting, createdBy: string): Meeting;
  updateMeeting(id: string, data: Partial<InsertMeeting>): Meeting | null;
  deleteMeeting(id: string): boolean;

  // Tickets
  listTickets(associationId: string): Ticket[];
  listAllTickets(): Ticket[];
  getTicket(id: string): Ticket | undefined;
  createTicket(input: InsertTicket, createdBy: string): Ticket;
  updateTicket(id: string, data: Partial<InsertTicket>): Ticket | null;
  deleteTicket(id: string): boolean;

  // Insurance Policies
  listInsurancePolicies(associationId: string): InsurancePolicy[];
  getInsurancePolicy(id: string): InsurancePolicy | undefined;
  createInsurancePolicy(input: InsertInsurancePolicy, createdBy: string): InsurancePolicy;
  updateInsurancePolicy(id: string, data: Partial<InsertInsurancePolicy>): InsurancePolicy | null;
  deleteInsurancePolicy(id: string): boolean;

  // Mailing Requests
  listMailingRequests(associationId: string): MailingRequest[];
  getMailingRequest(id: string): MailingRequest | undefined;
  createMailingRequest(input: InsertMailingRequest, createdBy: string): MailingRequest;
  updateMailingRequest(id: string, data: Partial<InsertMailingRequest>): MailingRequest | null;
  deleteMailingRequest(id: string): boolean;

  // Onboarding Checklists
  listOnboardingChecklists(associationId: string): OnboardingChecklist[];
  getOnboardingChecklist(id: string): OnboardingChecklist | undefined;
  createOnboardingChecklist(input: InsertOnboardingChecklist, createdBy: string): OnboardingChecklist;
  updateOnboardingChecklist(id: string, data: Partial<InsertOnboardingChecklist>): OnboardingChecklist | null;
  deleteOnboardingChecklist(id: string): boolean;
  toggleOnboardingItem(checklistId: string, itemId: string): OnboardingChecklist | null;

  // Accounting Items
  listAccountingItems(associationId: string): AccountingItem[];
  getAccountingItem(id: string): AccountingItem | undefined;
  createAccountingItem(input: InsertAccountingItem, createdBy: string): AccountingItem;
  updateAccountingItem(id: string, data: Partial<InsertAccountingItem>): AccountingItem | null;
  deleteAccountingItem(id: string): boolean;

  // Invoices
  listInvoices(associationId: string): Invoice[];
  getInvoice(id: string): Invoice | undefined;
  createInvoice(input: InsertInvoice, createdBy: string): Invoice;
  updateInvoice(id: string, data: Partial<InsertInvoice> & { status?: Invoice["status"] }): Invoice | null;
  deleteInvoice(id: string): boolean;

  // Vendors
  listVendors(associationId: string): Vendor[];
  listAllVendors(): Vendor[];
  getVendor(id: string): Vendor | undefined;
  createVendor(input: Omit<Vendor, "id" | "createdAt">, createdBy: string): Vendor;
  updateVendor(id: string, data: Partial<Vendor>): Vendor | null;
  deleteVendor(id: string): boolean;

  // CINC API Settings
  getCincSettings(): CincSettings;
  updateCincSettings(data: Partial<CincSettings>): CincSettings;
  addCincSyncLog(message: string, type: "info" | "error" | "success"): void;

  // Documents
  listDocuments(associationId: string): AssociationDocument[];
  listAllDocuments(): AssociationDocument[];
  getDocument(id: string): AssociationDocument | undefined;
  createDocument(input: Omit<AssociationDocument, "id" | "createdAt" | "updatedAt">, createdBy: string): AssociationDocument;
  updateDocument(id: string, data: Partial<AssociationDocument>): AssociationDocument | null;
  deleteDocument(id: string): boolean;
  setDocumentFile(docId: string, filename: string | null): void;
}

export class MemStorage implements IStorage {
  private users = new Map<string, User>();
  private associations = new Map<string, Association>();
  private userAssociations: UserAssociation[] = [];
  private notices = new Map<string, Notice>();
  private meetings = new Map<string, Meeting>();
  private magicCodes = new Map<string, { code: string; expiresAt: number }>();
  private tickets = new Map<string, Ticket>();
  private insurancePolicies = new Map<string, InsurancePolicy>();
  private mailingRequests = new Map<string, MailingRequest>();
  private onboardingChecklists = new Map<string, OnboardingChecklist>();
  private accountingItems = new Map<string, AccountingItem>();
  private invoices = new Map<string, Invoice>();
  private vendors = new Map<string, Vendor>();
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

  constructor() {
    // Seed super admin
    const adminId = uid();
    this.users.set(adminId, {
      id: adminId,
      email: "admin@vinemgt.com",
      name: "Vine Admin",
      role: "super_admin",
      createdAt: now(),
    });

    // Seed Jay
    const jayId = uid();
    this.users.set(jayId, {
      id: jayId,
      email: "jay@vinemgt.com",
      name: "Jay",
      role: "super_admin",
      createdAt: now(),
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
    });

    // Seed some notices
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
      });
    }

    // ── Seed Tickets ──
    const demoTickets: Array<{ title: string; priority: Ticket["priority"]; status: Ticket["status"] }> = [
      { title: "Fix pool gate lock", priority: "high", status: "open" },
      { title: "Update community website", priority: "medium", status: "in_progress" },
      { title: "Annual meeting room booking", priority: "low", status: "done" },
    ];
    for (const t of demoTickets) {
      const tid = uid();
      this.tickets.set(tid, {
        id: tid,
        associationId: rspoaId,
        title: t.title,
        priority: t.priority,
        status: t.status,
        createdBy: adminId,
        createdAt: now(),
      });
    }

    // ── Seed Insurance Policies ──
    const demoPolicies: Array<{
      coverageType: string;
      carrier: string;
      policyNumber: string;
      premium: number;
      effectiveDate: string;
      expirationDate: string;
    }> = [
      { coverageType: "General Liability", carrier: "State Farm", policyNumber: "GL-2025-001", premium: 4500, effectiveDate: "2025-01-01", expirationDate: "2026-01-01" },
      { coverageType: "Property", carrier: "Nationwide", policyNumber: "PROP-2025-042", premium: 12000, effectiveDate: "2025-03-01", expirationDate: "2026-03-01" },
      { coverageType: "D&O", carrier: "Hartford", policyNumber: "DO-2025-118", premium: 2200, effectiveDate: "2025-06-01", expirationDate: "2026-06-01" },
    ];
    for (const p of demoPolicies) {
      const pid = uid();
      this.insurancePolicies.set(pid, {
        id: pid,
        associationId: rspoaId,
        carrier: p.carrier,
        policyNumber: p.policyNumber,
        coverageType: p.coverageType,
        premium: p.premium,
        effectiveDate: p.effectiveDate,
        expirationDate: p.expirationDate,
        createdBy: adminId,
        createdAt: now(),
      });
    }

    // ── Seed Mailing Requests ──
    const demoMailings: Array<{
      title: string;
      mailingType: string;
      status: MailingRequest["status"];
      recipientCount: number;
    }> = [
      { title: "Annual Meeting Notice Mailing", mailingType: "Official Notice", status: "mailed", recipientCount: 450 },
      { title: "Budget Approval Package", mailingType: "Financial", status: "pending_approval", recipientCount: 450 },
    ];
    for (const mr of demoMailings) {
      const mrid = uid();
      this.mailingRequests.set(mrid, {
        id: mrid,
        associationId: rspoaId,
        title: mr.title,
        mailingType: mr.mailingType,
        status: mr.status,
        recipientCount: mr.recipientCount,
        requestedDate: now(),
        createdBy: adminId,
        createdAt: now(),
      });
    }

    // ── Seed Onboarding Checklist ──
    const onbId = uid();
    this.onboardingChecklists.set(onbId, {
      id: onbId,
      associationId: rspoaId,
      title: "New Community Setup",
      items: [
        { id: uid(), label: "Collect governing documents", completed: true, completedAt: now() },
        { id: uid(), label: "Set up bank accounts", completed: true, completedAt: now() },
        { id: uid(), label: "Configure insurance policies", completed: false },
        { id: uid(), label: "Create community website", completed: false },
        { id: uid(), label: "Send welcome packet to board", completed: false },
        { id: uid(), label: "Schedule first board meeting", completed: false },
      ],
      createdBy: adminId,
      createdAt: now(),
    });

    // ── Seed Accounting Items ──
    const demoAccounting: Array<{
      description: string;
      type: string;
      amount: number;
      amountPaid: number;
      status: AccountingItem["status"];
      dueDate: string;
      unit?: string;
    }> = [
      { description: "Assessment Q1 2025", type: "Assessment", amount: 1500, amountPaid: 1500, status: "paid", dueDate: "2025-01-15", unit: "101" },
      { description: "Assessment Q1 2025", type: "Assessment", amount: 1500, amountPaid: 750, status: "partial", dueDate: "2025-01-15", unit: "202" },
      { description: "Late Fee", type: "Late Fee", amount: 50, amountPaid: 0, status: "outstanding", dueDate: "2025-02-01", unit: "202" },
      { description: "Vendor Invoice - Landscaping", type: "Vendor Invoice", amount: 3200, amountPaid: 0, status: "outstanding", dueDate: "2025-03-15" },
    ];
    for (const ai of demoAccounting) {
      const aiid = uid();
      this.accountingItems.set(aiid, {
        id: aiid,
        associationId: rspoaId,
        description: ai.description,
        type: ai.type,
        amount: ai.amount,
        amountPaid: ai.amountPaid,
        status: ai.status,
        dueDate: ai.dueDate,
        unit: ai.unit,
        createdBy: adminId,
        createdAt: now(),
      });
    }

    // ── Seed Invoices ──
    const inv1Id = uid();
    this.invoices.set(inv1Id, {
      id: inv1Id,
      associationId: rspoaId,
      vendor: "Green Thumb Landscaping",
      invoiceNumber: "INV-2025-0042",
      invoiceDate: "2025-02-15",
      totalAmount: 3200,
      status: "review",
      lineItems: [
        { id: uid(), description: "Monthly lawn care", amount: 1800 },
        { id: uid(), description: "Tree trimming", amount: 900 },
        { id: uid(), description: "Mulch and flowers", amount: 500 },
      ],
      createdBy: adminId,
      createdAt: now(),
    });

    const inv2Id = uid();
    this.invoices.set(inv2Id, {
      id: inv2Id,
      associationId: rspoaId,
      vendor: "Sparkling Pools Inc",
      invoiceNumber: "INV-2025-0089",
      invoiceDate: "2025-03-01",
      totalAmount: 1450,
      status: "approved",
      lineItems: [
        { id: uid(), description: "Monthly pool service", amount: 850 },
        { id: uid(), description: "Chemical supply", amount: 350 },
        { id: uid(), description: "Filter replacement", amount: 250 },
      ],
      createdBy: adminId,
      createdAt: now(),
    });

    // ── Seed Vendors (RSPOA) ──
    const demoVendors: Array<{ name: string; contactName: string; phone: string; email: string; category: string; status: "active" | "inactive" }> = [
      { name: "Green Thumb Landscaping", contactName: "Mike Johnson", phone: "(352) 555-0142", email: "mike@greenthumb.com", category: "Landscaping", status: "active" },
      { name: "Sparkling Pools Inc", contactName: "Lisa Chen", phone: "(352) 555-0198", email: "lisa@sparklingpools.com", category: "Pool Service", status: "active" },
      { name: "SecureGuard Services", contactName: "Tom Williams", phone: "(352) 555-0231", email: "tom@secureguard.com", category: "Security", status: "active" },
    ];
    for (const v of demoVendors) {
      const vid = uid();
      this.vendors.set(vid, {
        id: vid,
        associationId: rspoaId,
        name: v.name,
        contactName: v.contactName,
        phone: v.phone,
        email: v.email,
        category: v.category,
        status: v.status,
        insuranceExpiry: "2026-06-01",
        notes: null,
        cincVendorId: null,
        createdBy: adminId,
        createdAt: now(),
      });
    }

    // ── Seed Documents (RSPOA) ──
    const demoDocuments: Array<{
      title: string; category: string; description: string;
      status: "current" | "archived"; effectiveDate: string | null;
      expirationDate: string | null; retentionYears: number | null;
      isPublic: boolean; tags: string[];
    }> = [
      { title: "Declaration of Covenants & Restrictions", category: "governing", description: "Original recorded declaration of covenants, conditions, and restrictions for Rainbow Springs POA.", status: "current", effectiveDate: "2005-06-15", expirationDate: null, retentionYears: null, isPublic: true, tags: ["CC&R", "declaration"] },
      { title: "Articles of Incorporation", category: "governing", description: "Articles of Incorporation filed with the Florida Division of Corporations.", status: "current", effectiveDate: "2005-06-01", expirationDate: null, retentionYears: null, isPublic: true, tags: ["corporate"] },
      { title: "Bylaws", category: "governing", description: "Current bylaws of the association as amended.", status: "current", effectiveDate: "2005-06-15", expirationDate: null, retentionYears: null, isPublic: true, tags: ["bylaws"] },
      { title: "Amendment to CC&R - Rental Restrictions", category: "governing", description: "2023 Amendment regarding rental restrictions and lease approval process.", status: "current", effectiveDate: "2023-09-01", expirationDate: null, retentionYears: null, isPublic: true, tags: ["amendment", "rental"] },
      { title: "Community Rules & Regulations", category: "rules", description: "Current community rules covering architectural standards, common areas, and conduct.", status: "current", effectiveDate: "2024-01-01", expirationDate: null, retentionYears: null, isPublic: true, tags: ["rules"] },
      { title: "2025 Annual Budget", category: "financial", description: "Approved annual operating budget for fiscal year 2025.", status: "current", effectiveDate: "2025-01-01", expirationDate: "2025-12-31", retentionYears: 7, isPublic: false, tags: ["budget", "2025"] },
      { title: "2024 Annual Financial Report", category: "financial", description: "Year-end audited financial statements for 2024.", status: "current", effectiveDate: "2024-01-01", expirationDate: null, retentionYears: 7, isPublic: false, tags: ["audit", "2024"] },
      { title: "Board Meeting Minutes - Feb 2025", category: "meeting_minutes", description: "Minutes from the February 18, 2025 board of directors meeting.", status: "current", effectiveDate: "2025-02-18", expirationDate: null, retentionYears: null, isPublic: true, tags: ["minutes", "board"] },
      { title: "Annual Meeting Minutes - Jan 2025", category: "meeting_minutes", description: "Minutes from the January 14, 2025 annual members meeting.", status: "current", effectiveDate: "2025-01-14", expirationDate: null, retentionYears: null, isPublic: true, tags: ["minutes", "annual"] },
      { title: "General Liability Policy 2025", category: "insurance", description: "State Farm general liability insurance certificate.", status: "current", effectiveDate: "2025-01-01", expirationDate: "2026-01-01", retentionYears: 7, isPublic: false, tags: ["liability"] },
      { title: "Management Agreement - Vine Management", category: "contracts", description: "Current management services agreement with Vine Management Group.", status: "current", effectiveDate: "2024-07-01", expirationDate: "2026-06-30", retentionYears: 7, isPublic: false, tags: ["management", "contract"] },
      { title: "Disclosure Summary", category: "disclosure", description: "HOA disclosure summary required under F.S. 720.401.", status: "current", effectiveDate: "2025-01-01", expirationDate: null, retentionYears: null, isPublic: true, tags: ["disclosure"] },
    ];
    for (const doc of demoDocuments) {
      const docId = uid();
      this.documents.set(docId, {
        id: docId,
        associationId: rspoaId,
        title: doc.title,
        category: doc.category,
        description: doc.description,
        status: doc.status,
        effectiveDate: doc.effectiveDate,
        expirationDate: doc.expirationDate,
        retentionYears: doc.retentionYears,
        isPublic: doc.isPublic,
        tags: doc.tags,
        createdBy: adminId,
        createdAt: now(),
        updatedAt: now(),
      });
    }

    // ══════════════════════════════════════════════════════════════════════
    // ── Second Association: Cypress Pointe HOA ──
    // ══════════════════════════════════════════════════════════════════════
    const cpId = uid();
    this.associations.set(cpId, {
      id: cpId,
      name: "Cypress Pointe HOA",
      slug: "cypress-pointe",
      primaryColor: "#1E40AF",
      accentColor: "#3B82F6",
      darkColor: "#1E3A5F",
      createdAt: now(),
    });

    // Seed tickets for Cypress Pointe
    const cpTickets: Array<{ title: string; description?: string; priority: Ticket["priority"]; status: Ticket["status"] }> = [
      { title: "Clubhouse HVAC not cooling", description: "AC unit in the main clubhouse not reaching set temperature.", priority: "urgent", status: "open" },
      { title: "Repaint speed bumps", description: "Speed bumps in sections B and C are faded.", priority: "medium", status: "in_progress" },
      { title: "Replace mailbox cluster Unit 300-310", priority: "high", status: "open" },
      { title: "Irrigation timer programming", description: "Zone 4 running at wrong times.", priority: "low", status: "review" },
    ];
    for (const t of cpTickets) {
      const tid = uid();
      this.tickets.set(tid, {
        id: tid,
        associationId: cpId,
        title: t.title,
        description: t.description,
        priority: t.priority,
        status: t.status,
        createdBy: adminId,
        createdAt: now(),
      });
    }

    // Seed a notice for Cypress Pointe
    const cpNoticeId = uid();
    this.notices.set(cpNoticeId, {
      id: cpNoticeId,
      associationId: cpId,
      date: "2025-03-10",
      title: "Spring Community Cleanup Day",
      type: "Event",
      description: "Join us for our annual spring cleanup.",
      postedDate: now(),
      createdBy: adminId,
    });

    // Seed a vendor for Cypress Pointe
    const cpVendorId = uid();
    this.vendors.set(cpVendorId, {
      id: cpVendorId,
      associationId: cpId,
      name: "BlueSky Pressure Washing",
      contactName: "Dave Martinez",
      phone: "(407) 555-0177",
      email: "dave@blueskypw.com",
      category: "Exterior Cleaning",
      status: "active",
      insuranceExpiry: "2026-04-15",
      notes: null,
      cincVendorId: null,
      createdBy: adminId,
      createdAt: now(),
    });
  }

  // ── Auth ──
  getUserByEmail(email: string): User | undefined {
    return [...this.users.values()].find((u) => u.email.toLowerCase() === email.toLowerCase());
  }
  getUserById(id: string): User | undefined {
    return this.users.get(id);
  }

  // ── Magic Codes ──
  createMagicCode(email: string): string {
    // 6-digit numeric code, valid for 10 minutes
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const key = email.toLowerCase();
    this.magicCodes.set(key, { code, expiresAt: Date.now() + 10 * 60 * 1000 });
    return code;
  }
  verifyMagicCode(email: string, code: string): boolean {
    const key = email.toLowerCase();
    const entry = this.magicCodes.get(key);
    if (!entry) return false;
    if (entry.expiresAt < Date.now()) {
      this.magicCodes.delete(key);
      return false;
    }
    if (entry.code !== code) return false;
    this.magicCodes.delete(key); // one-time use
    return true;
  }

  // ── Users ──
  listUsers(): SafeUser[] {
    return [...this.users.values()].map((u) => {
      const safe: SafeUser = { ...u, associations: this.getUserAssociations(u.id) };
      return safe;
    });
  }
  createUser(input: InsertUser): SafeUser {
    const id = uid();
    const user: User = {
      id,
      email: input.email,
      name: input.name,
      role: input.role,
      createdAt: now(),
    };
    this.users.set(id, user);
    return { ...user };
  }
  updateUser(id: string, data: Partial<InsertUser>): SafeUser | null {
    const existing = this.users.get(id);
    if (!existing) return null;
    if (data.email) existing.email = data.email;
    if (data.name) existing.name = data.name;
    if (data.role) existing.role = data.role;
    this.users.set(id, existing);
    return { ...existing, associations: this.getUserAssociations(id) };
  }
  deleteUser(id: string): boolean {
    this.userAssociations = this.userAssociations.filter((ua) => ua.userId !== id);
    return this.users.delete(id);
  }

  // ── User ↔ Association ──
  getUserAssociations(userId: string): (UserAssociation & { associationName: string })[] {
    return this.userAssociations
      .filter((ua) => ua.userId === userId)
      .map((ua) => ({
        ...ua,
        associationName: this.associations.get(ua.associationId)?.name || "Unknown",
      }));
  }
  setUserAssociations(userId: string, assignments: { associationId: string; permission: "manage" | "readonly" }[]): void {
    this.userAssociations = this.userAssociations.filter((ua) => ua.userId !== userId);
    for (const a of assignments) {
      this.userAssociations.push({ userId, associationId: a.associationId, permission: a.permission });
    }
  }
  canUserAccessAssociation(userId: string, associationId: string, requireManage = false): boolean {
    const user = this.users.get(userId);
    if (!user) return false;
    if (user.role === "super_admin") return true;
    const ua = this.userAssociations.find((x) => x.userId === userId && x.associationId === associationId);
    if (!ua) return false;
    if (requireManage && ua.permission !== "manage") return false;
    return true;
  }

  // ── Associations ──
  listAssociations(): Association[] {
    return [...this.associations.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
  getAssociation(id: string): Association | undefined {
    return this.associations.get(id);
  }
  getAssociationBySlug(slug: string): Association | undefined {
    return [...this.associations.values()].find((a) => a.slug === slug);
  }
  createAssociation(input: InsertAssociation): Association {
    const id = uid();
    const assoc: Association = { id, ...input, createdAt: now() };
    this.associations.set(id, assoc);
    return assoc;
  }
  updateAssociation(id: string, data: Partial<InsertAssociation>): Association | null {
    const existing = this.associations.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...data };
    this.associations.set(id, updated);
    return updated;
  }
  deleteAssociation(id: string): boolean {
    for (const [nid, n] of this.notices) {
      if (n.associationId === id) this.notices.delete(nid);
    }
    this.userAssociations = this.userAssociations.filter((ua) => ua.associationId !== id);
    return this.associations.delete(id);
  }

  // ── Notices ──
  listNotices(associationId: string): Notice[] {
    return [...this.notices.values()]
      .filter((n) => n.associationId === associationId)
      .sort((a, b) => b.date.localeCompare(a.date));
  }
  getNotice(id: string): Notice | undefined {
    return this.notices.get(id);
  }
  createNotice(input: InsertNotice, createdBy: string): Notice {
    const id = uid();
    const notice: Notice = {
      id,
      ...input,
      description: input.description || "",
      meetingUrl: input.meetingUrl || "",
      pdfFilename: undefined,
      postedDate: now(),
      createdBy,
    };
    this.notices.set(id, notice);
    return notice;
  }
  updateNotice(id: string, data: Partial<InsertNotice>): Notice | null {
    const existing = this.notices.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...data };
    this.notices.set(id, updated);
    return updated;
  }
  deleteNotice(id: string): boolean {
    return this.notices.delete(id);
  }
  setNoticePdf(noticeId: string, filename: string | null): void {
    const n = this.notices.get(noticeId);
    if (n) {
      n.pdfFilename = filename || undefined;
      this.notices.set(noticeId, n);
    }
  }

  // ── Meetings ──
  listMeetings(associationId: string): Meeting[] {
    return [...this.meetings.values()]
      .filter((m) => m.associationId === associationId)
      .sort((a, b) => b.date.localeCompare(a.date));
  }
  getMeeting(id: string): Meeting | undefined {
    return this.meetings.get(id);
  }
  createMeeting(input: InsertMeeting, createdBy: string): Meeting {
    const id = uid();
    const meeting: Meeting = {
      id,
      ...input,
      description: input.description || "",
      videoUrl: input.videoUrl || "",
      agendaUrl: input.agendaUrl || "",
      minutesUrl: input.minutesUrl || "",
      createdBy,
      createdAt: now(),
    };
    this.meetings.set(id, meeting);
    return meeting;
  }
  updateMeeting(id: string, data: Partial<InsertMeeting>): Meeting | null {
    const existing = this.meetings.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...data };
    this.meetings.set(id, updated);
    return updated;
  }
  deleteMeeting(id: string): boolean {
    return this.meetings.delete(id);
  }

  // ── Tickets ──
  listTickets(associationId: string): Ticket[] {
    return [...this.tickets.values()]
      .filter((t) => t.associationId === associationId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  listAllTickets(): Ticket[] {
    return [...this.tickets.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  getTicket(id: string): Ticket | undefined {
    return this.tickets.get(id);
  }
  createTicket(input: InsertTicket, createdBy: string): Ticket {
    const id = uid();
    const ticket: Ticket = {
      id,
      ...input,
      createdBy,
      createdAt: now(),
    };
    this.tickets.set(id, ticket);
    return ticket;
  }
  updateTicket(id: string, data: Partial<InsertTicket>): Ticket | null {
    const existing = this.tickets.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...data };
    this.tickets.set(id, updated);
    return updated;
  }
  deleteTicket(id: string): boolean {
    return this.tickets.delete(id);
  }

  // ── Insurance Policies ──
  listInsurancePolicies(associationId: string): InsurancePolicy[] {
    return [...this.insurancePolicies.values()]
      .filter((p) => p.associationId === associationId)
      .sort((a, b) => a.expirationDate.localeCompare(b.expirationDate));
  }
  getInsurancePolicy(id: string): InsurancePolicy | undefined {
    return this.insurancePolicies.get(id);
  }
  createInsurancePolicy(input: InsertInsurancePolicy, createdBy: string): InsurancePolicy {
    const id = uid();
    const policy: InsurancePolicy = {
      id,
      ...input,
      createdBy,
      createdAt: now(),
    };
    this.insurancePolicies.set(id, policy);
    return policy;
  }
  updateInsurancePolicy(id: string, data: Partial<InsertInsurancePolicy>): InsurancePolicy | null {
    const existing = this.insurancePolicies.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...data };
    this.insurancePolicies.set(id, updated);
    return updated;
  }
  deleteInsurancePolicy(id: string): boolean {
    return this.insurancePolicies.delete(id);
  }

  // ── Mailing Requests ──
  listMailingRequests(associationId: string): MailingRequest[] {
    return [...this.mailingRequests.values()]
      .filter((m) => m.associationId === associationId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  getMailingRequest(id: string): MailingRequest | undefined {
    return this.mailingRequests.get(id);
  }
  createMailingRequest(input: InsertMailingRequest, createdBy: string): MailingRequest {
    const id = uid();
    const mailing: MailingRequest = {
      id,
      ...input,
      requestedDate: now(),
      createdBy,
      createdAt: now(),
    };
    this.mailingRequests.set(id, mailing);
    return mailing;
  }
  updateMailingRequest(id: string, data: Partial<InsertMailingRequest>): MailingRequest | null {
    const existing = this.mailingRequests.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...data };
    this.mailingRequests.set(id, updated);
    return updated;
  }
  deleteMailingRequest(id: string): boolean {
    return this.mailingRequests.delete(id);
  }

  // ── Onboarding Checklists ──
  listOnboardingChecklists(associationId: string): OnboardingChecklist[] {
    return [...this.onboardingChecklists.values()]
      .filter((c) => c.associationId === associationId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  getOnboardingChecklist(id: string): OnboardingChecklist | undefined {
    return this.onboardingChecklists.get(id);
  }
  createOnboardingChecklist(input: InsertOnboardingChecklist, createdBy: string): OnboardingChecklist {
    const id = uid();
    const checklist: OnboardingChecklist = {
      id,
      associationId: input.associationId,
      title: input.title,
      items: (input.items || []).map((item) => ({
        id: uid(),
        label: item.label,
        completed: false,
      })),
      createdBy,
      createdAt: now(),
    };
    this.onboardingChecklists.set(id, checklist);
    return checklist;
  }
  updateOnboardingChecklist(id: string, data: Partial<InsertOnboardingChecklist>): OnboardingChecklist | null {
    const existing = this.onboardingChecklists.get(id);
    if (!existing) return null;
    const updated: OnboardingChecklist = {
      ...existing,
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.associationId !== undefined ? { associationId: data.associationId } : {}),
    };
    this.onboardingChecklists.set(id, updated);
    return updated;
  }
  deleteOnboardingChecklist(id: string): boolean {
    return this.onboardingChecklists.delete(id);
  }
  toggleOnboardingItem(checklistId: string, itemId: string): OnboardingChecklist | null {
    const checklist = this.onboardingChecklists.get(checklistId);
    if (!checklist) return null;
    const items = checklist.items.map((item) => {
      if (item.id !== itemId) return item;
      const completed = !item.completed;
      return {
        ...item,
        completed,
        completedAt: completed ? now() : undefined,
      };
    });
    const updated = { ...checklist, items };
    this.onboardingChecklists.set(checklistId, updated);
    return updated;
  }

  // ── Accounting Items ──
  listAccountingItems(associationId: string): AccountingItem[] {
    return [...this.accountingItems.values()]
      .filter((a) => a.associationId === associationId)
      .sort((a, b) => b.dueDate.localeCompare(a.dueDate));
  }
  getAccountingItem(id: string): AccountingItem | undefined {
    return this.accountingItems.get(id);
  }
  createAccountingItem(input: InsertAccountingItem, createdBy: string): AccountingItem {
    const id = uid();
    const item: AccountingItem = {
      id,
      ...input,
      amountPaid: input.amountPaid ?? 0,
      createdBy,
      createdAt: now(),
    };
    this.accountingItems.set(id, item);
    return item;
  }
  updateAccountingItem(id: string, data: Partial<InsertAccountingItem>): AccountingItem | null {
    const existing = this.accountingItems.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...data };
    this.accountingItems.set(id, updated);
    return updated;
  }
  deleteAccountingItem(id: string): boolean {
    return this.accountingItems.delete(id);
  }

  // ── Invoices ──
  listInvoices(associationId: string): Invoice[] {
    return [...this.invoices.values()]
      .filter((inv) => inv.associationId === associationId)
      .sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate));
  }
  getInvoice(id: string): Invoice | undefined {
    return this.invoices.get(id);
  }
  createInvoice(input: InsertInvoice, createdBy: string): Invoice {
    const id = uid();
    const invoice: Invoice = {
      id,
      associationId: input.associationId,
      vendor: input.vendor,
      invoiceNumber: input.invoiceNumber,
      invoiceDate: input.invoiceDate,
      totalAmount: input.totalAmount,
      status: "uploaded",
      lineItems: (input.lineItems || []).map((li) => ({
        id: uid(),
        description: li.description,
        amount: li.amount,
        category: li.category,
        glCode: li.glCode,
      })),
      notes: input.notes,
      createdBy,
      createdAt: now(),
    };
    this.invoices.set(id, invoice);
    return invoice;
  }
  updateInvoice(id: string, data: Partial<InsertInvoice> & { status?: Invoice["status"] }): Invoice | null {
    const existing = this.invoices.get(id);
    if (!existing) return null;
    const { lineItems, ...rest } = data;
    const updated: Invoice = {
      ...existing,
      ...rest,
      ...(lineItems !== undefined ? {
        lineItems: lineItems.map((li) => ({
          id: uid(),
          description: li.description,
          amount: li.amount,
          category: li.category,
          glCode: li.glCode,
        })),
      } : {}),
    };
    this.invoices.set(id, updated);
    return updated;
  }
  deleteInvoice(id: string): boolean {
    return this.invoices.delete(id);
  }

  // ── Vendors ──
  listVendors(associationId: string): Vendor[] {
    return [...this.vendors.values()]
      .filter((v) => v.associationId === associationId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  listAllVendors(): Vendor[] {
    return [...this.vendors.values()]
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  getVendor(id: string): Vendor | undefined {
    return this.vendors.get(id);
  }
  createVendor(input: Omit<Vendor, "id" | "createdAt">, createdBy: string): Vendor {
    const id = uid();
    const vendor: Vendor = { id, ...input, createdBy, createdAt: now() };
    this.vendors.set(id, vendor);
    return vendor;
  }
  updateVendor(id: string, data: Partial<Vendor>): Vendor | null {
    const existing = this.vendors.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...data };
    this.vendors.set(id, updated);
    return updated;
  }
  deleteVendor(id: string): boolean {
    return this.vendors.delete(id);
  }

  // ── CINC API Settings ──
  getCincSettings(): CincSettings {
    return { ...this.cincSettings };
  }
  updateCincSettings(data: Partial<CincSettings>): CincSettings {
    this.cincSettings = { ...this.cincSettings, ...data };
    return { ...this.cincSettings };
  }
  addCincSyncLog(message: string, type: "info" | "error" | "success"): void {
    this.cincSettings.syncLog.unshift({ timestamp: now(), message, type });
    if (this.cincSettings.syncLog.length > 50) {
      this.cincSettings.syncLog = this.cincSettings.syncLog.slice(0, 50);
    }
  }

  // ── Documents ──
  private documents = new Map<string, AssociationDocument>();

  listDocuments(associationId: string): AssociationDocument[] {
    return [...this.documents.values()]
      .filter((d) => d.associationId === associationId)
      .sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title));
  }
  listAllDocuments(): AssociationDocument[] {
    return [...this.documents.values()]
      .sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title));
  }
  getDocument(id: string): AssociationDocument | undefined {
    return this.documents.get(id);
  }
  createDocument(input: Omit<AssociationDocument, "id" | "createdAt" | "updatedAt">, createdBy: string): AssociationDocument {
    const id = uid();
    const doc: AssociationDocument = { id, ...input, createdBy, createdAt: now(), updatedAt: now() };
    this.documents.set(id, doc);
    return doc;
  }
  updateDocument(id: string, data: Partial<AssociationDocument>): AssociationDocument | null {
    const existing = this.documents.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...data, updatedAt: now() };
    this.documents.set(id, updated);
    return updated;
  }
  deleteDocument(id: string): boolean {
    return this.documents.delete(id);
  }
  setDocumentFile(docId: string, filename: string | null): void {
    const d = this.documents.get(docId);
    if (d) {
      d.filename = filename || undefined;
      d.updatedAt = now();
      this.documents.set(docId, d);
    }
  }
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

export const storage = new MemStorage();
