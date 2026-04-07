import type { Express } from "express";
import type { Server } from "http";

import authRoutes from "./auth";
import associationRoutes from "./associations";
import userRoutes from "./users";
import noticeRoutes from "./notices";
import meetingRoutes from "./meetings";
import ticketRoutes from "./tickets";
import insuranceRoutes from "./insurance";
import mailingRoutes from "./mailings";
import onboardingRoutes from "./onboarding";
import accountingRoutes from "./accounting";
import invoiceRoutes from "./invoices";
import vendorRoutes from "./vendors";
import documentRoutes from "./documents";
import statsRoutes from "./stats";
import brandingRoutes from "./branding";
import cincRoutes from "./cinc";
import publicRoutes from "./public";
import aiRoutes from "./ai";

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Initialize shared in-memory stores for AI features
  app.locals.meetingNoticesStore = [];
  app.locals.meetingMinutesStore = [];

  // Register all route modules
  app.use(authRoutes);
  app.use(associationRoutes);
  app.use(userRoutes);
  app.use(noticeRoutes);
  app.use(meetingRoutes);
  app.use(ticketRoutes);
  app.use(insuranceRoutes);
  app.use(mailingRoutes);
  app.use(onboardingRoutes);
  app.use(accountingRoutes);
  app.use(invoiceRoutes);
  app.use(vendorRoutes);
  app.use(documentRoutes);
  app.use(statsRoutes);
  app.use(brandingRoutes);
  app.use(cincRoutes);
  app.use(publicRoutes);
  app.use(aiRoutes);

  return httpServer;
}
