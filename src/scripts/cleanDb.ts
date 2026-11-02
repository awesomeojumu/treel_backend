import 'dotenv/config';
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

// Configure public DNS resolution for Atlas SRV queries on Windows
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
  // Fall back to system resolver
}

export async function cleanAndResetDatabase(options: { wipeTransactionsOnly?: boolean } = {}) {
  const uri = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb+srv://treelApp:gViIDKL8WRLnxmRr@planexi.b36hqe0.mongodb.net/Treel?retryWrites=true&w=majority';

  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  }

  const organizationId = 'org_skyline_lagos';

  // Always delete all transactional data for user testing
  const deletedClients = await ClientModel.deleteMany({ organizationId });
  const deletedLeads = await LeadModel.deleteMany({ organizationId });
  const deletedBookings = await BookingModel.deleteMany({ organizationId });
  const deletedPayments = await PaymentModel.deleteMany({ organizationId });

  // Delete any other collections if present
  const collections = await mongoose.connection.db?.listCollections().toArray();
  if (collections) {
    for (const col of collections) {
      if (!['organizations', 'users', 'clients', 'leads', 'bookings', 'payments'].includes(col.name)) {
        try {
          await mongoose.connection.db?.collection(col.name).deleteMany({});
        } catch {
          // ignore system collection errors
        }
      }
    }
  }

  const defaultPasswordHash = await argon2.hash('Password123!');

  // Reset Organization
  await OrganizationModel.deleteMany({ organizationId });
  const org = await OrganizationModel.create({
    organizationId,
    name: 'Skyline Travels and Tours Ltd',
    rcNumber: 'RC 1234567',
    branch: 'Ikeja, Lagos',
    countryCode: 'NG',
    baseCurrency: 'NGN',
    vatRatePercent: 7.5,
    ownerUserId: 'usr_adaeze',
  });

  // Reset / Ensure the 3 clean user accounts for testing
  await UserModel.deleteMany({ organizationId });

  const owner = await UserModel.create({
    userId: 'usr_adaeze',
    organizationId,
    name: 'Adaeze Okafor',
    email: 'owner@skylinetravels.ng',
    passwordHash: defaultPasswordHash,
    initials: 'AO',
    roleKey: 'OWNER',
    roleLabel: 'Owner',
    branch: 'Ikeja, Lagos',
    phone: '+234 803 100 0001',
    statusText: 'Active',
    isLive: true,
    bookingsCount: 0,
    salesMonthKobo: 0,
    collectedMonthKobo: 0,
  });

  const staff1 = await UserModel.create({
    userId: 'usr_tunde',
    organizationId,
    name: 'Tunde Bakare',
    email: 'tunde@skylinetravels.ng',
    passwordHash: defaultPasswordHash,
    initials: 'TB',
    roleKey: 'OPERATIONS_MANAGER',
    roleLabel: 'Operations manager',
    branch: 'Ikeja, Lagos',
    phone: '+234 803 100 0002',
    statusText: 'Active',
    isLive: true,
    bookingsCount: 0,
    salesMonthKobo: 0,
    collectedMonthKobo: 0,
  });

  const staff2 = await UserModel.create({
    userId: 'usr_bisi',
    organizationId,
    name: 'Bisi Adeyemi',
    email: 'bisi@skylinetravels.ng',
    passwordHash: defaultPasswordHash,
    initials: 'BA',
    roleKey: 'SALES_AGENT',
    roleLabel: 'Sales agent',
    branch: 'Ikeja, Lagos',
    phone: '+234 803 100 0003',
    statusText: 'Active',
    isLive: true,
    bookingsCount: 0,
    salesMonthKobo: 0,
    collectedMonthKobo: 0,
  });

  return {
    database: mongoose.connection.name,
    organization: org.name,
    accountsReady: [
      { name: owner.name, email: owner.email, role: owner.roleLabel, password: 'Password123!' },
      { name: staff1.name, email: staff1.email, role: staff1.roleLabel, password: 'Password123!' },
      { name: staff2.name, email: staff2.email, role: staff2.roleLabel, password: 'Password123!' },
    ],
    recordsWiped: {
      clients: deletedClients.deletedCount,
      leads: deletedLeads.deletedCount,
      bookings: deletedBookings.deletedCount,
      payments: deletedPayments.deletedCount,
    },
    currentState: {
      clients: 0,
      leads: 0,
      bookings: 0,
      payments: 0,
    },
  };
}

async function run() {
  console.log('Cleaning database for fresh user testing...');
  try {
    const summary = await cleanAndResetDatabase();
    console.log('DATABASE CLEANED AND READY FOR USER TESTING:');
    console.log(JSON.stringify(summary, null, 2));
    await mongoose.disconnect();
    process.exit(0);
  } catch (err: any) {
    console.error('Error cleaning database:', err);
    process.exit(1);
  }
}

run();
