import dns from 'dns';
import mongoose from 'mongoose';
import argon2 from 'argon2';
import {
  OrganizationModel,
  UserModel,
  ClientModel,
  LeadModel,
  BookingModel,
  PaymentModel,
} from '@/models';

// Public DNS resolver to prevent Windows SRV lookup failures
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
  // Fall back to default
}

export async function seedLiveDatabase(
  mongoUri?: string,
  customOrgId?: string,
  customAgencyName?: string,
  customOwnerEmail?: string,
  customOwnerName?: string
): Promise<{
  success: boolean;
  database: string;
  agencyName: string;
  owner: { name: string; email: string; role: string };
  staff: { name: string; email: string; role: string }[];
  clientsCount: number;
  leadsCount: number;
  bookingsCount: number;
  paymentsCount: number;
}> {
  const uri = mongoUri || process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI environment variable is required');

  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  }

  const organizationId = customOrgId || 'org_live_agency';
  const agencyName = customAgencyName || 'Agency Workspace';
  const ownerName = customOwnerName || 'Agency Owner';
  const ownerEmail = (customOwnerEmail || 'owner@agency.ng').toLowerCase();
  const defaultPasswordHash = await argon2.hash('Password123!');

  // 1. Seed Organization
  await OrganizationModel.deleteMany({ organizationId });
  const org = await OrganizationModel.create({
    organizationId,
    name: agencyName,
    rcNumber: 'RC-100200',
    branch: 'Headquarters, Nigeria',
    countryCode: 'NG',
    baseCurrency: 'NGN',
    vatRatePercent: 7.5,
    ownerUserId: 'usr_owner',
  });

  // 2. Seed Owner and Staff Members
  await UserModel.deleteMany({ organizationId });

  const owner = await UserModel.create({
    userId: 'usr_owner',
    organizationId,
    name: ownerName,
    email: ownerEmail,
    passwordHash: defaultPasswordHash,
    initials: ownerName.slice(0, 2).toUpperCase(),
    roleKey: 'OWNER',
    roleLabel: 'Owner',
    branch: 'Headquarters, Nigeria',
    phone: '+2348000000001',
    statusText: 'Active',
    isLive: true,
    bookingsCount: 0,
    salesMonthKobo: 0,
    collectedMonthKobo: 0,
  });

  return {
    success: true,
    database: mongoose.connection.name,
    agencyName: org.name,
    owner: { name: owner.name, email: owner.email, role: owner.roleLabel },
    staff: [],
    clientsCount: 0,
    leadsCount: 0,
    bookingsCount: 0,
    paymentsCount: 0,
  };
}

import { fileURLToPath } from 'url';

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  seedLiveDatabase()
    .then((res) => {
      console.log('Live Database Seed Completed Successfully:', JSON.stringify(res, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error('Database Seed Failed:', err);
      process.exit(1);
    });
}
