import crypto from "crypto";
import { eq, and, desc, asc } from "drizzle-orm";
import { db } from "./db";
import * as s from "../shared/db-schema";
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
import type { IStorage, CincSettings, Vendor, AssociationDocument } from "./storage";

function uid(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

export class DatabaseStorage implements IStorage {
  // ── Auth ──
  async getUserByEmail(email: string): Promise<User | undefined> {
    const row = await db.query.users.findFirst({
      where: eq(s.users.email, email.toLowerCase()),
    });
    return row ? { id: row.id, email: row.email, name: row.name, role: row.role as User["role"], createdAt: row.createdAt } : undefined;
  }

  async getUserById(id: string): Promise<User | undefined> {
    const row = await db.query.users.findFirst({ where: eq(s.users.id, id) });
    return row ? { id: row.id, email: row.email, name: row.name, role: row.role as User["role"], createdAt: row.createdAt } : undefined;
  }

  // ── Magic Codes ──
  async createMagicCode(email: string): Promise<string> {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const key = email.toLowerCase();
    // Delete any existing codes for this email
    await db.delete(s.magicCodes).where(eq(s.magicCodes.email, key));
    await db.insert(s.magicCodes).values({
      id: uid(),
      email: key,
      code,
      expiresAt: Date.now() + 10 * 60 * 1000,
      used: false,
    });
    return code;
  }

  async verifyMagicCode(email: string, code: string): Promise<boolean> {
    const key = email.toLowerCase();
    const row = await db.query.magicCodes.findFirst({
      where: and(eq(s.magicCodes.email, key), eq(s.magicCodes.used, false)),
    });
    if (!row) return false;
    if (row.expiresAt < Date.now()) {
      await db.delete(s.magicCodes).where(eq(s.magicCodes.id, row.id));
      return false;
    }
    if (row.code !== code) return false;
    await db.delete(s.magicCodes).where(eq(s.magicCodes.id, row.id));
    return true;
  }

  // ── Users ──
  async listUsers(): Promise<SafeUser[]> {
    const rows = await db.select().from(s.users);
    const result: SafeUser[] = [];
    for (const u of rows) {
      const associations = await this.getUserAssociations(u.id);
      result.push({ id: u.id, email: u.email, name: u.name, role: u.role as User["role"], createdAt: u.createdAt, associations });
    }
    return result;
  }

  async createUser(input: InsertUser): Promise<SafeUser> {
    const id = uid();
    const user: User = { id, email: input.email, name: input.name, role: input.role, createdAt: now() };
    await db.insert(s.users).values(user);
    return { ...user };
  }

  async updateUser(id: string, data: Partial<InsertUser>): Promise<SafeUser | null> {
    const existing = await this.getUserById(id);
    if (!existing) return null;
    const updated = { ...existing };
    if (data.email) updated.email = data.email;
    if (data.name) updated.name = data.name;
    if (data.role) updated.role = data.role;
    await db.update(s.users).set({ email: updated.email, name: updated.name, role: updated.role }).where(eq(s.users.id, id));
    const associations = await this.getUserAssociations(id);
    return { ...updated, associations };
  }

  async deleteUser(id: string): Promise<boolean> {
    await db.delete(s.userAssociations).where(eq(s.userAssociations.userId, id));
    const result = await db.delete(s.users).where(eq(s.users.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // ── User ↔ Association ──
  async getUserAssociations(userId: string): Promise<(UserAssociation & { associationName: string })[]> {
    const rows = await db.select().from(s.userAssociations).where(eq(s.userAssociations.userId, userId));
    const result: (UserAssociation & { associationName: string })[] = [];
    for (const ua of rows) {
      const assoc = await db.query.associations.findFirst({ where: eq(s.associations.id, ua.associationId) });
      result.push({
        userId: ua.userId,
        associationId: ua.associationId,
        permission: ua.permission as "manage" | "readonly",
        associationName: assoc?.name || "Unknown",
      });
    }
    return result;
  }

  async setUserAssociations(userId: string, assignments: { associationId: string; permission: "manage" | "readonly" }[]): Promise<void> {
    await db.delete(s.userAssociations).where(eq(s.userAssociations.userId, userId));
    if (assignments.length > 0) {
      await db.insert(s.userAssociations).values(
        assignments.map((a) => ({ userId, associationId: a.associationId, permission: a.permission })),
      );
    }
  }

  async canUserAccessAssociation(userId: string, associationId: string, requireManage = false): Promise<boolean> {
    const user = await this.getUserById(userId);
    if (!user) return false;
    if (user.role === "super_admin") return true;
    const ua = await db.query.userAssociations.findFirst({
      where: and(eq(s.userAssociations.userId, userId), eq(s.userAssociations.associationId, associationId)),
    });
    if (!ua) return false;
    if (requireManage && ua.permission !== "manage") return false;
    return true;
  }

  // ── Associations ──
  async listAssociations(): Promise<Association[]> {
    const rows = await db.select().from(s.associations).orderBy(asc(s.associations.name));
    return rows as Association[];
  }

  async getAssociation(id: string): Promise<Association | undefined> {
    const row = await db.query.associations.findFirst({ where: eq(s.associations.id, id) });
    return row as Association | undefined;
  }

  async getAssociationBySlug(slug: string): Promise<Association | undefined> {
    const row = await db.query.associations.findFirst({ where: eq(s.associations.slug, slug) });
    return row as Association | undefined;
  }

  async createAssociation(input: InsertAssociation): Promise<Association> {
    const id = uid();
    const assoc: Association = { id, ...input, createdAt: now() };
    await db.insert(s.associations).values(assoc);
    return assoc;
  }

  async updateAssociation(id: string, data: Partial<InsertAssociation>): Promise<Association | null> {
    const existing = await this.getAssociation(id);
    if (!existing) return null;
    const updated = { ...existing, ...data };
    await db.update(s.associations).set(data).where(eq(s.associations.id, id));
    return updated;
  }

  async deleteAssociation(id: string): Promise<boolean> {
    // Cascading deletes handle notices, meetings, etc.
    const result = await db.delete(s.associations).where(eq(s.associations.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // ── Notices ──
  async listNotices(associationId: string): Promise<Notice[]> {
    const rows = await db.select().from(s.notices)
      .where(eq(s.notices.associationId, associationId))
      .orderBy(desc(s.notices.date));
    return rows.map((r) => ({
      id: r.id, associationId: r.associationId, date: r.date, title: r.title,
      type: r.type, description: r.description ?? undefined, pdfFilename: r.pdfFilename ?? undefined,
      meetingUrl: r.meetingUrl ?? undefined, postedDate: r.postedDate, createdBy: r.createdBy,
    }));
  }

  async getNotice(id: string): Promise<Notice | undefined> {
    const r = await db.query.notices.findFirst({ where: eq(s.notices.id, id) });
    if (!r) return undefined;
    return {
      id: r.id, associationId: r.associationId, date: r.date, title: r.title,
      type: r.type, description: r.description ?? undefined, pdfFilename: r.pdfFilename ?? undefined,
      meetingUrl: r.meetingUrl ?? undefined, postedDate: r.postedDate, createdBy: r.createdBy,
    };
  }

  async createNotice(input: InsertNotice, createdBy: string): Promise<Notice> {
    const id = uid();
    const notice: Notice = {
      id, ...input, description: input.description || "", meetingUrl: input.meetingUrl || "",
      pdfFilename: undefined, postedDate: now(), createdBy,
    };
    await db.insert(s.notices).values({
      id, associationId: input.associationId, date: input.date, title: input.title,
      type: input.type, description: input.description || "", meetingUrl: input.meetingUrl || "",
      postedDate: now(), createdBy,
    });
    return notice;
  }

  async updateNotice(id: string, data: Partial<InsertNotice>): Promise<Notice | null> {
    const existing = await this.getNotice(id);
    if (!existing) return null;
    const updated = { ...existing, ...data };
    await db.update(s.notices).set(data).where(eq(s.notices.id, id));
    return updated;
  }

  async deleteNotice(id: string): Promise<boolean> {
    const result = await db.delete(s.notices).where(eq(s.notices.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async setNoticePdf(noticeId: string, filename: string | null): Promise<void> {
    await db.update(s.notices).set({ pdfFilename: filename }).where(eq(s.notices.id, noticeId));
  }

  // ── Meetings ──
  async listMeetings(associationId: string): Promise<Meeting[]> {
    const rows = await db.select().from(s.meetings)
      .where(eq(s.meetings.associationId, associationId))
      .orderBy(desc(s.meetings.date));
    return rows.map((r) => ({
      id: r.id, associationId: r.associationId, date: r.date, title: r.title,
      description: r.description ?? undefined, videoUrl: r.videoUrl ?? undefined,
      agendaUrl: r.agendaUrl ?? undefined, minutesUrl: r.minutesUrl ?? undefined,
      createdBy: r.createdBy, createdAt: r.createdAt,
    }));
  }

  async getMeeting(id: string): Promise<Meeting | undefined> {
    const r = await db.query.meetings.findFirst({ where: eq(s.meetings.id, id) });
    if (!r) return undefined;
    return {
      id: r.id, associationId: r.associationId, date: r.date, title: r.title,
      description: r.description ?? undefined, videoUrl: r.videoUrl ?? undefined,
      agendaUrl: r.agendaUrl ?? undefined, minutesUrl: r.minutesUrl ?? undefined,
      createdBy: r.createdBy, createdAt: r.createdAt,
    };
  }

  async createMeeting(input: InsertMeeting, createdBy: string): Promise<Meeting> {
    const id = uid();
    const meeting: Meeting = {
      id, ...input, description: input.description || "", videoUrl: input.videoUrl || "",
      agendaUrl: input.agendaUrl || "", minutesUrl: input.minutesUrl || "", createdBy, createdAt: now(),
    };
    await db.insert(s.meetings).values({
      id, associationId: input.associationId, date: input.date, title: input.title,
      description: input.description || "", videoUrl: input.videoUrl || "",
      agendaUrl: input.agendaUrl || "", minutesUrl: input.minutesUrl || "",
      createdBy, createdAt: now(),
    });
    return meeting;
  }

  async updateMeeting(id: string, data: Partial<InsertMeeting>): Promise<Meeting | null> {
    const existing = await this.getMeeting(id);
    if (!existing) return null;
    const updated = { ...existing, ...data };
    await db.update(s.meetings).set(data).where(eq(s.meetings.id, id));
    return updated;
  }

  async deleteMeeting(id: string): Promise<boolean> {
    const result = await db.delete(s.meetings).where(eq(s.meetings.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // ── Tickets ──
  async listTickets(associationId: string): Promise<Ticket[]> {
    const rows = await db.select().from(s.tickets)
      .where(eq(s.tickets.associationId, associationId))
      .orderBy(desc(s.tickets.createdAt));
    return rows.map((r) => ({
      id: r.id, associationId: r.associationId, title: r.title, description: r.description ?? undefined,
      status: r.status as Ticket["status"], priority: r.priority as Ticket["priority"],
      assignee: r.assignee ?? undefined, createdBy: r.createdBy, createdAt: r.createdAt,
    }));
  }

  async listAllTickets(): Promise<Ticket[]> {
    const rows = await db.select().from(s.tickets).orderBy(desc(s.tickets.createdAt));
    return rows.map((r) => ({
      id: r.id, associationId: r.associationId, title: r.title, description: r.description ?? undefined,
      status: r.status as Ticket["status"], priority: r.priority as Ticket["priority"],
      assignee: r.assignee ?? undefined, createdBy: r.createdBy, createdAt: r.createdAt,
    }));
  }

  async getTicket(id: string): Promise<Ticket | undefined> {
    const r = await db.query.tickets.findFirst({ where: eq(s.tickets.id, id) });
    if (!r) return undefined;
    return {
      id: r.id, associationId: r.associationId, title: r.title, description: r.description ?? undefined,
      status: r.status as Ticket["status"], priority: r.priority as Ticket["priority"],
      assignee: r.assignee ?? undefined, createdBy: r.createdBy, createdAt: r.createdAt,
    };
  }

  async createTicket(input: InsertTicket, createdBy: string): Promise<Ticket> {
    const id = uid();
    const ticket: Ticket = { id, ...input, createdBy, createdAt: now() };
    await db.insert(s.tickets).values({
      id, associationId: input.associationId, title: input.title,
      description: input.description, status: input.status || "open",
      priority: input.priority || "medium", assignee: input.assignee,
      createdBy, createdAt: now(),
    });
    return ticket;
  }

  async updateTicket(id: string, data: Partial<InsertTicket>): Promise<Ticket | null> {
    const existing = await this.getTicket(id);
    if (!existing) return null;
    const updated = { ...existing, ...data };
    await db.update(s.tickets).set(data).where(eq(s.tickets.id, id));
    return updated;
  }

  async deleteTicket(id: string): Promise<boolean> {
    const result = await db.delete(s.tickets).where(eq(s.tickets.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // ── Insurance Policies ──
  async listInsurancePolicies(associationId: string): Promise<InsurancePolicy[]> {
    const rows = await db.select().from(s.insurancePolicies)
      .where(eq(s.insurancePolicies.associationId, associationId))
      .orderBy(asc(s.insurancePolicies.expirationDate));
    return rows.map((r) => ({
      id: r.id, associationId: r.associationId, carrier: r.carrier,
      policyNumber: r.policyNumber, coverageType: r.coverageType,
      premium: r.premium ?? undefined, effectiveDate: r.effectiveDate,
      expirationDate: r.expirationDate, notes: r.notes ?? undefined,
      createdBy: r.createdBy, createdAt: r.createdAt,
    }));
  }

  async getInsurancePolicy(id: string): Promise<InsurancePolicy | undefined> {
    const r = await db.query.insurancePolicies.findFirst({ where: eq(s.insurancePolicies.id, id) });
    if (!r) return undefined;
    return {
      id: r.id, associationId: r.associationId, carrier: r.carrier,
      policyNumber: r.policyNumber, coverageType: r.coverageType,
      premium: r.premium ?? undefined, effectiveDate: r.effectiveDate,
      expirationDate: r.expirationDate, notes: r.notes ?? undefined,
      createdBy: r.createdBy, createdAt: r.createdAt,
    };
  }

  async createInsurancePolicy(input: InsertInsurancePolicy, createdBy: string): Promise<InsurancePolicy> {
    const id = uid();
    const policy: InsurancePolicy = { id, ...input, createdBy, createdAt: now() };
    await db.insert(s.insurancePolicies).values({
      id, associationId: input.associationId, carrier: input.carrier,
      policyNumber: input.policyNumber, coverageType: input.coverageType,
      premium: input.premium, effectiveDate: input.effectiveDate,
      expirationDate: input.expirationDate, notes: input.notes,
      createdBy, createdAt: now(),
    });
    return policy;
  }

  async updateInsurancePolicy(id: string, data: Partial<InsertInsurancePolicy>): Promise<InsurancePolicy | null> {
    const existing = await this.getInsurancePolicy(id);
    if (!existing) return null;
    const updated = { ...existing, ...data };
    await db.update(s.insurancePolicies).set(data).where(eq(s.insurancePolicies.id, id));
    return updated;
  }

  async deleteInsurancePolicy(id: string): Promise<boolean> {
    const result = await db.delete(s.insurancePolicies).where(eq(s.insurancePolicies.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // ── Mailing Requests ──
  async listMailingRequests(associationId: string): Promise<MailingRequest[]> {
    const rows = await db.select().from(s.mailingRequests)
      .where(eq(s.mailingRequests.associationId, associationId))
      .orderBy(desc(s.mailingRequests.createdAt));
    return rows.map((r) => ({
      id: r.id, associationId: r.associationId, title: r.title,
      description: r.description ?? undefined, recipientCount: r.recipientCount ?? undefined,
      mailingType: r.mailingType, status: r.status as MailingRequest["status"],
      requestedDate: r.requestedDate, targetMailDate: r.targetMailDate ?? undefined,
      createdBy: r.createdBy, createdAt: r.createdAt,
    }));
  }

  async getMailingRequest(id: string): Promise<MailingRequest | undefined> {
    const r = await db.query.mailingRequests.findFirst({ where: eq(s.mailingRequests.id, id) });
    if (!r) return undefined;
    return {
      id: r.id, associationId: r.associationId, title: r.title,
      description: r.description ?? undefined, recipientCount: r.recipientCount ?? undefined,
      mailingType: r.mailingType, status: r.status as MailingRequest["status"],
      requestedDate: r.requestedDate, targetMailDate: r.targetMailDate ?? undefined,
      createdBy: r.createdBy, createdAt: r.createdAt,
    };
  }

  async createMailingRequest(input: InsertMailingRequest, createdBy: string): Promise<MailingRequest> {
    const id = uid();
    const mailing: MailingRequest = { id, ...input, requestedDate: now(), createdBy, createdAt: now() };
    await db.insert(s.mailingRequests).values({
      id, associationId: input.associationId, title: input.title,
      description: input.description, recipientCount: input.recipientCount,
      mailingType: input.mailingType, status: input.status || "draft",
      requestedDate: now(), targetMailDate: input.targetMailDate,
      createdBy, createdAt: now(),
    });
    return mailing;
  }

  async updateMailingRequest(id: string, data: Partial<InsertMailingRequest>): Promise<MailingRequest | null> {
    const existing = await this.getMailingRequest(id);
    if (!existing) return null;
    const updated = { ...existing, ...data };
    await db.update(s.mailingRequests).set(data).where(eq(s.mailingRequests.id, id));
    return updated;
  }

  async deleteMailingRequest(id: string): Promise<boolean> {
    const result = await db.delete(s.mailingRequests).where(eq(s.mailingRequests.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // ── Onboarding Checklists ──
  async listOnboardingChecklists(associationId: string): Promise<OnboardingChecklist[]> {
    const rows = await db.select().from(s.onboardingChecklists)
      .where(eq(s.onboardingChecklists.associationId, associationId))
      .orderBy(desc(s.onboardingChecklists.createdAt));
    return rows.map((r) => ({
      id: r.id, associationId: r.associationId, title: r.title,
      items: (r.items as any[]) || [], createdBy: r.createdBy, createdAt: r.createdAt,
    }));
  }

  async getOnboardingChecklist(id: string): Promise<OnboardingChecklist | undefined> {
    const r = await db.query.onboardingChecklists.findFirst({ where: eq(s.onboardingChecklists.id, id) });
    if (!r) return undefined;
    return {
      id: r.id, associationId: r.associationId, title: r.title,
      items: (r.items as any[]) || [], createdBy: r.createdBy, createdAt: r.createdAt,
    };
  }

  async createOnboardingChecklist(input: InsertOnboardingChecklist, createdBy: string): Promise<OnboardingChecklist> {
    const id = uid();
    const items = (input.items || []).map((item) => ({
      id: uid(), label: item.label, completed: false,
    }));
    const checklist: OnboardingChecklist = { id, associationId: input.associationId, title: input.title, items, createdBy, createdAt: now() };
    await db.insert(s.onboardingChecklists).values({
      id, associationId: input.associationId, title: input.title,
      items, createdBy, createdAt: now(),
    });
    return checklist;
  }

  async updateOnboardingChecklist(id: string, data: Partial<InsertOnboardingChecklist>): Promise<OnboardingChecklist | null> {
    const existing = await this.getOnboardingChecklist(id);
    if (!existing) return null;
    const updated: OnboardingChecklist = {
      ...existing,
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.associationId !== undefined ? { associationId: data.associationId } : {}),
    };
    await db.update(s.onboardingChecklists).set({
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.associationId !== undefined ? { associationId: data.associationId } : {}),
    }).where(eq(s.onboardingChecklists.id, id));
    return updated;
  }

  async deleteOnboardingChecklist(id: string): Promise<boolean> {
    const result = await db.delete(s.onboardingChecklists).where(eq(s.onboardingChecklists.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async toggleOnboardingItem(checklistId: string, itemId: string): Promise<OnboardingChecklist | null> {
    const checklist = await this.getOnboardingChecklist(checklistId);
    if (!checklist) return null;
    const items = checklist.items.map((item) => {
      if (item.id !== itemId) return item;
      const completed = !item.completed;
      return { ...item, completed, completedAt: completed ? now() : undefined };
    });
    await db.update(s.onboardingChecklists).set({ items }).where(eq(s.onboardingChecklists.id, checklistId));
    return { ...checklist, items };
  }

  // ── Accounting Items ──
  async listAccountingItems(associationId: string): Promise<AccountingItem[]> {
    const rows = await db.select().from(s.accountingItems)
      .where(eq(s.accountingItems.associationId, associationId))
      .orderBy(desc(s.accountingItems.dueDate));
    return rows.map((r) => ({
      id: r.id, associationId: r.associationId, description: r.description,
      type: r.type, amount: r.amount, amountPaid: r.amountPaid,
      status: r.status as AccountingItem["status"], dueDate: r.dueDate,
      unit: r.unit ?? undefined, notes: r.notes ?? undefined,
      createdBy: r.createdBy, createdAt: r.createdAt,
    }));
  }

  async getAccountingItem(id: string): Promise<AccountingItem | undefined> {
    const r = await db.query.accountingItems.findFirst({ where: eq(s.accountingItems.id, id) });
    if (!r) return undefined;
    return {
      id: r.id, associationId: r.associationId, description: r.description,
      type: r.type, amount: r.amount, amountPaid: r.amountPaid,
      status: r.status as AccountingItem["status"], dueDate: r.dueDate,
      unit: r.unit ?? undefined, notes: r.notes ?? undefined,
      createdBy: r.createdBy, createdAt: r.createdAt,
    };
  }

  async createAccountingItem(input: InsertAccountingItem, createdBy: string): Promise<AccountingItem> {
    const id = uid();
    const item: AccountingItem = { id, ...input, amountPaid: input.amountPaid ?? 0, createdBy, createdAt: now() };
    await db.insert(s.accountingItems).values({
      id, associationId: input.associationId, description: input.description,
      type: input.type, amount: input.amount, amountPaid: input.amountPaid ?? 0,
      status: input.status || "outstanding", dueDate: input.dueDate,
      unit: input.unit, notes: input.notes, createdBy, createdAt: now(),
    });
    return item;
  }

  async updateAccountingItem(id: string, data: Partial<InsertAccountingItem>): Promise<AccountingItem | null> {
    const existing = await this.getAccountingItem(id);
    if (!existing) return null;
    const updated = { ...existing, ...data };
    await db.update(s.accountingItems).set(data).where(eq(s.accountingItems.id, id));
    return updated;
  }

  async deleteAccountingItem(id: string): Promise<boolean> {
    const result = await db.delete(s.accountingItems).where(eq(s.accountingItems.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // ── Invoices ──
  async listInvoices(associationId: string): Promise<Invoice[]> {
    const rows = await db.select().from(s.invoices)
      .where(eq(s.invoices.associationId, associationId))
      .orderBy(desc(s.invoices.invoiceDate));
    return rows.map((r) => ({
      id: r.id, associationId: r.associationId, vendor: r.vendor,
      invoiceNumber: r.invoiceNumber ?? undefined, invoiceDate: r.invoiceDate,
      totalAmount: r.totalAmount, status: r.status as Invoice["status"],
      lineItems: (r.lineItems as any[]) || [], notes: r.notes ?? undefined,
      createdBy: r.createdBy, createdAt: r.createdAt,
    }));
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    const r = await db.query.invoices.findFirst({ where: eq(s.invoices.id, id) });
    if (!r) return undefined;
    return {
      id: r.id, associationId: r.associationId, vendor: r.vendor,
      invoiceNumber: r.invoiceNumber ?? undefined, invoiceDate: r.invoiceDate,
      totalAmount: r.totalAmount, status: r.status as Invoice["status"],
      lineItems: (r.lineItems as any[]) || [], notes: r.notes ?? undefined,
      createdBy: r.createdBy, createdAt: r.createdAt,
    };
  }

  async createInvoice(input: InsertInvoice, createdBy: string): Promise<Invoice> {
    const id = uid();
    const lineItems = (input.lineItems || []).map((li) => ({
      id: uid(), description: li.description, amount: li.amount,
      category: li.category, glCode: li.glCode,
    }));
    const invoice: Invoice = {
      id, associationId: input.associationId, vendor: input.vendor,
      invoiceNumber: input.invoiceNumber, invoiceDate: input.invoiceDate,
      totalAmount: input.totalAmount, status: "uploaded", lineItems,
      notes: input.notes, createdBy, createdAt: now(),
    };
    await db.insert(s.invoices).values({
      id, associationId: input.associationId, vendor: input.vendor,
      invoiceNumber: input.invoiceNumber, invoiceDate: input.invoiceDate,
      totalAmount: input.totalAmount, status: "uploaded", lineItems,
      notes: input.notes, createdBy, createdAt: now(),
    });
    return invoice;
  }

  async updateInvoice(id: string, data: Partial<InsertInvoice> & { status?: Invoice["status"] }): Promise<Invoice | null> {
    const existing = await this.getInvoice(id);
    if (!existing) return null;
    const { lineItems, ...rest } = data;
    const newLineItems = lineItems !== undefined
      ? lineItems.map((li) => ({ id: uid(), description: li.description, amount: li.amount, category: li.category, glCode: li.glCode }))
      : undefined;
    const updated: Invoice = {
      ...existing, ...rest,
      ...(newLineItems !== undefined ? { lineItems: newLineItems } : {}),
    };
    await db.update(s.invoices).set({
      ...rest,
      ...(newLineItems !== undefined ? { lineItems: newLineItems } : {}),
    }).where(eq(s.invoices.id, id));
    return updated;
  }

  async deleteInvoice(id: string): Promise<boolean> {
    const result = await db.delete(s.invoices).where(eq(s.invoices.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // ── Vendors ──
  async listVendors(associationId: string): Promise<Vendor[]> {
    const rows = await db.select().from(s.vendors)
      .where(eq(s.vendors.associationId, associationId))
      .orderBy(asc(s.vendors.name));
    return rows.map((r) => ({
      id: r.id, associationId: r.associationId, name: r.name,
      contactName: r.contactName, phone: r.phone, email: r.email,
      category: r.category, status: r.status as "active" | "inactive",
      insuranceExpiry: r.insuranceExpiry, notes: r.notes,
      cincVendorId: r.cincVendorId, createdBy: r.createdBy, createdAt: r.createdAt,
    }));
  }

  async listAllVendors(): Promise<Vendor[]> {
    const rows = await db.select().from(s.vendors).orderBy(asc(s.vendors.name));
    return rows.map((r) => ({
      id: r.id, associationId: r.associationId, name: r.name,
      contactName: r.contactName, phone: r.phone, email: r.email,
      category: r.category, status: r.status as "active" | "inactive",
      insuranceExpiry: r.insuranceExpiry, notes: r.notes,
      cincVendorId: r.cincVendorId, createdBy: r.createdBy, createdAt: r.createdAt,
    }));
  }

  async getVendor(id: string): Promise<Vendor | undefined> {
    const r = await db.query.vendors.findFirst({ where: eq(s.vendors.id, id) });
    if (!r) return undefined;
    return {
      id: r.id, associationId: r.associationId, name: r.name,
      contactName: r.contactName, phone: r.phone, email: r.email,
      category: r.category, status: r.status as "active" | "inactive",
      insuranceExpiry: r.insuranceExpiry, notes: r.notes,
      cincVendorId: r.cincVendorId, createdBy: r.createdBy, createdAt: r.createdAt,
    };
  }

  async createVendor(input: Omit<Vendor, "id" | "createdAt">, createdBy: string): Promise<Vendor> {
    const id = uid();
    const vendor: Vendor = { id, ...input, createdBy, createdAt: now() };
    await db.insert(s.vendors).values({
      id, associationId: input.associationId, name: input.name,
      contactName: input.contactName, phone: input.phone, email: input.email,
      category: input.category, status: input.status, insuranceExpiry: input.insuranceExpiry,
      notes: input.notes, cincVendorId: input.cincVendorId, createdBy, createdAt: now(),
    });
    return vendor;
  }

  async updateVendor(id: string, data: Partial<Vendor>): Promise<Vendor | null> {
    const existing = await this.getVendor(id);
    if (!existing) return null;
    const updated = { ...existing, ...data };
    await db.update(s.vendors).set(data).where(eq(s.vendors.id, id));
    return updated;
  }

  async deleteVendor(id: string): Promise<boolean> {
    const result = await db.delete(s.vendors).where(eq(s.vendors.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // ── CINC API Settings ──
  async getCincSettings(): Promise<CincSettings> {
    const row = await db.query.cincSettings.findFirst({ where: eq(s.cincSettings.id, "singleton") });
    if (!row) {
      // Create default settings
      const defaults: CincSettings = {
        clientId: "", clientSecret: "", environment: "uat", scope: "cincapi.all",
        enabled: false, lastSyncAt: null, syncStatus: "idle", syncLog: [],
      };
      await db.insert(s.cincSettings).values({
        id: "singleton", clientId: "", clientSecret: "", environment: "uat",
        scope: "cincapi.all", enabled: false, syncStatus: "idle", syncLog: [],
      });
      return defaults;
    }
    return {
      clientId: row.clientId, clientSecret: row.clientSecret,
      environment: row.environment as "uat" | "production", scope: row.scope,
      enabled: row.enabled, lastSyncAt: row.lastSyncAt,
      syncStatus: row.syncStatus as CincSettings["syncStatus"],
      syncLog: (row.syncLog as any[]) || [],
      lastSyncData: row.lastSyncData as CincSettings["lastSyncData"],
    };
  }

  async updateCincSettings(data: Partial<CincSettings>): Promise<CincSettings> {
    const current = await this.getCincSettings();
    const updated = { ...current, ...data };
    await db.update(s.cincSettings).set({
      clientId: updated.clientId, clientSecret: updated.clientSecret,
      environment: updated.environment, scope: updated.scope,
      enabled: updated.enabled, lastSyncAt: updated.lastSyncAt,
      syncStatus: updated.syncStatus, syncLog: updated.syncLog,
      lastSyncData: updated.lastSyncData,
    }).where(eq(s.cincSettings.id, "singleton"));
    return updated;
  }

  async addCincSyncLog(message: string, type: "info" | "error" | "success"): Promise<void> {
    const settings = await this.getCincSettings();
    settings.syncLog.unshift({ timestamp: now(), message, type });
    if (settings.syncLog.length > 50) {
      settings.syncLog = settings.syncLog.slice(0, 50);
    }
    await db.update(s.cincSettings).set({ syncLog: settings.syncLog }).where(eq(s.cincSettings.id, "singleton"));
  }

  // ── Documents ──
  async listDocuments(associationId: string): Promise<AssociationDocument[]> {
    const rows = await db.select().from(s.documents)
      .where(eq(s.documents.associationId, associationId))
      .orderBy(asc(s.documents.category), asc(s.documents.title));
    return rows.map((r) => ({
      id: r.id, associationId: r.associationId, title: r.title,
      category: r.category, description: r.description,
      filename: r.filename ?? undefined, fileSize: r.fileSize ?? undefined,
      status: r.status as AssociationDocument["status"],
      effectiveDate: r.effectiveDate, expirationDate: r.expirationDate,
      retentionYears: r.retentionYears, isPublic: r.isPublic,
      tags: (r.tags as string[]) || [], createdBy: r.createdBy,
      createdAt: r.createdAt, updatedAt: r.updatedAt,
    }));
  }

  async listAllDocuments(): Promise<AssociationDocument[]> {
    const rows = await db.select().from(s.documents)
      .orderBy(asc(s.documents.category), asc(s.documents.title));
    return rows.map((r) => ({
      id: r.id, associationId: r.associationId, title: r.title,
      category: r.category, description: r.description,
      filename: r.filename ?? undefined, fileSize: r.fileSize ?? undefined,
      status: r.status as AssociationDocument["status"],
      effectiveDate: r.effectiveDate, expirationDate: r.expirationDate,
      retentionYears: r.retentionYears, isPublic: r.isPublic,
      tags: (r.tags as string[]) || [], createdBy: r.createdBy,
      createdAt: r.createdAt, updatedAt: r.updatedAt,
    }));
  }

  async getDocument(id: string): Promise<AssociationDocument | undefined> {
    const r = await db.query.documents.findFirst({ where: eq(s.documents.id, id) });
    if (!r) return undefined;
    return {
      id: r.id, associationId: r.associationId, title: r.title,
      category: r.category, description: r.description,
      filename: r.filename ?? undefined, fileSize: r.fileSize ?? undefined,
      status: r.status as AssociationDocument["status"],
      effectiveDate: r.effectiveDate, expirationDate: r.expirationDate,
      retentionYears: r.retentionYears, isPublic: r.isPublic,
      tags: (r.tags as string[]) || [], createdBy: r.createdBy,
      createdAt: r.createdAt, updatedAt: r.updatedAt,
    };
  }

  async createDocument(input: Omit<AssociationDocument, "id" | "createdAt" | "updatedAt">, createdBy: string): Promise<AssociationDocument> {
    const id = uid();
    const doc: AssociationDocument = { id, ...input, createdBy, createdAt: now(), updatedAt: now() };
    await db.insert(s.documents).values({
      id, associationId: input.associationId, title: input.title,
      category: input.category, description: input.description,
      filename: input.filename, fileSize: input.fileSize,
      status: input.status, effectiveDate: input.effectiveDate,
      expirationDate: input.expirationDate, retentionYears: input.retentionYears,
      isPublic: input.isPublic, tags: input.tags,
      createdBy, createdAt: now(), updatedAt: now(),
    });
    return doc;
  }

  async updateDocument(id: string, data: Partial<AssociationDocument>): Promise<AssociationDocument | null> {
    const existing = await this.getDocument(id);
    if (!existing) return null;
    const updated = { ...existing, ...data, updatedAt: now() };
    await db.update(s.documents).set({ ...data, updatedAt: now() }).where(eq(s.documents.id, id));
    return updated;
  }

  async deleteDocument(id: string): Promise<boolean> {
    const result = await db.delete(s.documents).where(eq(s.documents.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async setDocumentFile(docId: string, filename: string | null): Promise<void> {
    await db.update(s.documents).set({ filename, updatedAt: now() }).where(eq(s.documents.id, docId));
  }
}
