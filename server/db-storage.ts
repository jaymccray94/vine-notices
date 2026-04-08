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
} from "@shared/schema";
import type { IStorage, CincSettings, AssociationDocument, BrandingData } from "./storage";

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
    return row ? { id: row.id, email: row.email, name: row.name, role: row.role as User["role"], active: row.active ?? true, authMethod: (row as any).authMethod ?? "magic_link", createdAt: row.createdAt, organizationId: row.organizationId ?? 1 } : undefined;
  }

  async getUserById(id: string): Promise<User | undefined> {
    const row = await db.query.users.findFirst({ where: eq(s.users.id, id) });
    return row ? { id: row.id, email: row.email, name: row.name, role: row.role as User["role"], active: row.active ?? true, authMethod: (row as any).authMethod ?? "magic_link", createdAt: row.createdAt, organizationId: row.organizationId ?? 1 } : undefined;
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
      result.push({ id: u.id, email: u.email, name: u.name, role: u.role as User["role"], active: (u as any).active ?? true, authMethod: (u as any).authMethod ?? "magic_link", createdAt: u.createdAt, organizationId: (u as any).organizationId ?? 1, associations });
    }
    return result;
  }

  async createUser(input: InsertUser): Promise<SafeUser> {
    const id = uid();
    const user: User = { id, email: input.email, name: input.name, role: input.role, active: true, authMethod: "magic_link", createdAt: now(), organizationId: 1 };
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
      meetingUrl: r.meetingUrl ?? undefined, postedDate: r.postedDate, createdBy: r.createdBy, organizationId: (r as any).organizationId ?? 1,
    }));
  }

  async getNotice(id: string): Promise<Notice | undefined> {
    const r = await db.query.notices.findFirst({ where: eq(s.notices.id, id) });
    if (!r) return undefined;
    return {
      id: r.id, associationId: r.associationId, date: r.date, title: r.title,
      type: r.type, description: r.description ?? undefined, pdfFilename: r.pdfFilename ?? undefined,
      meetingUrl: r.meetingUrl ?? undefined, postedDate: r.postedDate, createdBy: r.createdBy, organizationId: (r as any).organizationId ?? 1,
    };
  }

  async createNotice(input: InsertNotice, createdBy: string): Promise<Notice> {
    const id = uid();
    const notice: Notice = {
      id, ...input, description: input.description || "", meetingUrl: input.meetingUrl || "",
      pdfFilename: undefined, postedDate: now(), createdBy, organizationId: 1,
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
      createdBy: r.createdBy, createdAt: r.createdAt, organizationId: (r as any).organizationId ?? 1,
    }));
  }

  async getMeeting(id: string): Promise<Meeting | undefined> {
    const r = await db.query.meetings.findFirst({ where: eq(s.meetings.id, id) });
    if (!r) return undefined;
    return {
      id: r.id, associationId: r.associationId, date: r.date, title: r.title,
      description: r.description ?? undefined, videoUrl: r.videoUrl ?? undefined,
      agendaUrl: r.agendaUrl ?? undefined, minutesUrl: r.minutesUrl ?? undefined,
      createdBy: r.createdBy, createdAt: r.createdAt, organizationId: (r as any).organizationId ?? 1,
    };
  }

  async createMeeting(input: InsertMeeting, createdBy: string): Promise<Meeting> {
    const id = uid();
    const meeting: Meeting = {
      id, ...input, description: input.description || "", videoUrl: input.videoUrl || "",
      agendaUrl: input.agendaUrl || "", minutesUrl: input.minutesUrl || "", createdBy, createdAt: now(), organizationId: 1,
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
      createdAt: r.createdAt, updatedAt: r.updatedAt, organizationId: (r as any).organizationId ?? 1,
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
      createdAt: r.createdAt, updatedAt: r.updatedAt, organizationId: (r as any).organizationId ?? 1,
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
      createdAt: r.createdAt, updatedAt: r.updatedAt, organizationId: (r as any).organizationId ?? 1,
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

  // ── Branding ──
  private static DEFAULT_BRANDING: BrandingData = {
    companyName: "Vine Management",
    primaryColor: "#317C3C",
    sidebarColor: "#1B3E1E",
    accentColor: "#8BC53F",
  };

  async getBranding(): Promise<BrandingData> {
    try {
      const row = await db.query.brandingSettings.findFirst({
        where: eq(s.brandingSettings.organizationId, 1),
      });
      if (!row) return { ...DatabaseStorage.DEFAULT_BRANDING };
      return {
        companyName: row.companyName,
        primaryColor: row.primaryColor,
        sidebarColor: row.sidebarColor,
        accentColor: row.accentColor,
        logoUrl: row.logoUrl,
        faviconUrl: row.faviconUrl,
        footerText: row.footerText,
      };
    } catch {
      return { ...DatabaseStorage.DEFAULT_BRANDING };
    }
  }

  async updateBranding(data: Partial<BrandingData>): Promise<BrandingData> {
    const existing = await db.query.brandingSettings.findFirst({
      where: eq(s.brandingSettings.organizationId, 1),
    });

    const row = {
      companyName: data.companyName,
      primaryColor: data.primaryColor,
      sidebarColor: data.sidebarColor,
      accentColor: data.accentColor,
      footerText: data.footerText,
      logoUrl: data.logoUrl,
      faviconUrl: data.faviconUrl,
      organizationId: 1,
      updatedAt: new Date(),
    };

    if (existing) {
      await db.update(s.brandingSettings).set(row).where(eq(s.brandingSettings.id, existing.id));
    } else {
      await db.insert(s.brandingSettings).values(row);
    }

    return this.getBranding();
  }
}
