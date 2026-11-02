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

export async function seedLiveDatabase(mongoUri?: string): Promise<{
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
  const uri = mongoUri || process.env.MONGODB_URI || 'mongodb+srv://treelApp:gViIDKL8WRLnxmRr@planexi.b36hqe0.mongodb.net/Treel?retryWrites=true&w=majority';

  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  }

  const organizationId = 'org_skyline_lagos';
  const defaultPasswordHash = await argon2.hash('Password123!');

  // 1. Seed Organization
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

  // 2. Seed 1 Owner and 2 Staff Members
  await UserModel.deleteMany({ organizationId });

  // 1 Owner: Adaeze Okafor
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
    statusText: 'Clocked in 08:02',
    isLive: true,
    bookingsCount: 4,
    salesMonthKobo: 4_180_000_00,
    collectedMonthKobo: 3_200_000_00,
  });

  // Staff 1: Tunde Bakare (Operations Manager)
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
    statusText: 'Clocked in 08:15',
    isLive: true,
    bookingsCount: 3,
    salesMonthKobo: 2_450_000_00,
    collectedMonthKobo: 2_450_000_00,
  });

  // Staff 2: Bisi Adeyemi (Sales Agent)
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
    statusText: 'Field visit (logged 09:30)',
    isLive: true,
    bookingsCount: 2,
    salesMonthKobo: 850_000_00,
    collectedMonthKobo: 300_000_00,
  });

  // 3. Seed Clients
  await ClientModel.deleteMany({ organizationId });
  const clients = await ClientModel.insertMany([
    {
      clientId: 'CL-001',
      organizationId,
      name: 'Ngozi Nwosu',
      phone: '+234 803 123 4567',
      email: 'ngozi@nwosu.ng',
      tag: 'VIP Corporate',
      ownerName: 'Tunde Bakare',
      ownerUserId: 'usr_tunde',
      passportMasked: 'A08••••••',
      passportExpiry: '2029-04-15',
    },
    {
      clientId: 'CL-002',
      organizationId,
      name: 'Chief Obinna',
      phone: '+234 802 987 6543',
      email: 'chief.obinna@apex.ng',
      tag: 'High Net Worth',
      ownerName: 'Bisi Adeyemi',
      ownerUserId: 'usr_bisi',
      passportMasked: 'A14••••••',
      passportExpiry: '2030-08-20',
    },
    {
      clientId: 'CL-003',
      organizationId,
      name: 'Folake Ogunleye',
      phone: '+234 809 555 1212',
      email: 'folake@ogunleye.com',
      tag: 'Frequent Flyer',
      ownerName: 'Adaeze Okafor',
      ownerUserId: 'usr_adaeze',
      passportMasked: 'A21••••••',
      passportExpiry: '2028-11-10',
    },
  ]);

  // 4. Seed Leads
  await LeadModel.deleteMany({ organizationId });
  const leads = await LeadModel.insertMany([
    {
      leadId: 'LD-2026-001',
      organizationId,
      clientId: 'CL-002',
      clientName: 'Chief Obinna',
      phone: '+234 802 987 6543',
      requestSummary: 'London Club World return ticket with Heathrow VIP escort',
      source: 'WhatsApp',
      stage: 'Won',
      ownerName: 'Bisi Adeyemi',
      ownerUserId: 'usr_bisi',
      valueKobo: 850_000_00,
      followUpLabel: 'Completed',
      convertedBookingId: 'BK-2026-001',
    },
    {
      leadId: 'LD-2026-002',
      organizationId,
      clientId: 'CL-001',
      clientName: 'Ngozi Nwosu',
      phone: '+234 803 123 4567',
      requestSummary: 'Dubai luxury resort 5-night package for 2',
      source: 'Call',
      stage: 'Won',
      ownerName: 'Tunde Bakare',
      ownerUserId: 'usr_tunde',
      valueKobo: 2_450_000_00,
      followUpLabel: 'Completed',
      convertedBookingId: 'BK-2026-002',
    },
    {
      leadId: 'LD-2026-003',
      organizationId,
      clientId: 'CL-003',
      clientName: 'Folake Ogunleye',
      phone: '+234 809 555 1212',
      requestSummary: 'UK 6-month standard visitor visa documentation',
      source: 'Walk-in',
      stage: 'Quoted',
      ownerName: 'Adaeze Okafor',
      ownerUserId: 'usr_adaeze',
      valueKobo: 350_000_00,
      followUpLabel: 'Today 15:00',
    },
  ]);

  // 5. Seed Bookings
  await BookingModel.deleteMany({ organizationId });
  const bookings = await BookingModel.insertMany([
    {
      bookingId: 'BK-2026-001',
      organizationId,
      title: 'Lagos to London Club World Return',
      clientId: 'CL-002',
      clientName: 'Chief Obinna',
      clientPhone: '+234 802 987 6543',
      leadId: 'LD-2026-001',
      type: 'Flight',
      soldBy: 'Bisi Adeyemi',
      soldByUserId: 'usr_bisi',
      status: 'Part-paid',
      items: [
        {
          id: 'item-1',
          type: 'Flight',
          title: 'British Airways Club World Return (LOS-LHR)',
          costKobo: 680_000_00,
          priceKobo: 850_000_00,
        },
      ],
      totalKobo: 850_000_00,
      paidKobo: 300_000_00,
      owedKobo: 550_000_00,
      dateLabel: 'Travels 12 Nov 2026',
      entryOrigin: 'FROM_LEAD',
    },
    {
      bookingId: 'BK-2026-002',
      organizationId,
      title: 'Dubai 5-Star Package for 2 (Emirates + Atlantis)',
      clientId: 'CL-001',
      clientName: 'Ngozi Nwosu',
      clientPhone: '+234 803 123 4567',
      leadId: 'LD-2026-002',
      type: 'Package',
      soldBy: 'Tunde Bakare',
      soldByUserId: 'usr_tunde',
      status: 'Paid',
      items: [
        {
          id: 'item-2',
          type: 'Package',
          title: 'Emirates Economy + Atlantis The Palm 5 nights',
          costKobo: 1_950_000_00,
          priceKobo: 2_450_000_00,
        },
      ],
      totalKobo: 2_450_000_00,
      paidKobo: 2_450_000_00,
      owedKobo: 0,
      dateLabel: 'Travels 24 Dec 2026',
      entryOrigin: 'FROM_LEAD',
    },
    {
      bookingId: 'BK-2026-003',
      organizationId,
      title: 'UK 6-Month Standard Visitor Visa Processing',
      clientId: 'CL-003',
      clientName: 'Folake Ogunleye',
      clientPhone: '+234 809 555 1212',
      leadId: 'LD-2026-003',
      type: 'Visa',
      soldBy: 'Adaeze Okafor',
      soldByUserId: 'usr_adaeze',
      status: 'Paid',
      items: [
        {
          id: 'item-3',
          type: 'Visa',
          title: 'UK Visa Fee + TLS Express Appointment',
          costKobo: 240_000_00,
          priceKobo: 350_000_00,
        },
      ],
      totalKobo: 350_000_00,
      paidKobo: 350_000_00,
      owedKobo: 0,
      dateLabel: 'Appointment 18 Nov 2026',
      entryOrigin: 'FROM_ACCEPTED_QUOTE',
    },
  ]);

  // 6. Seed Payments
  await PaymentModel.deleteMany({ organizationId });
  const payments = await PaymentModel.insertMany([
    {
      paymentId: 'PAY-2026-001',
      organizationId,
      bookingId: 'BK-2026-001',
      clientName: 'Chief Obinna',
      amountKobo: 300_000_00,
      channel: 'Direct Bank Transfer',
      reference: 'TRF-GTB-2026-001',
      receivedAt: '2026-11-02 09:30 WAT',
      recordedBy: 'Bisi Adeyemi',
      recordedByUserId: 'usr_bisi',
      proofFileName: 'gtb_transfer_300k.pdf',
      status: 'Confirmed',
    },
    {
      paymentId: 'PAY-2026-002',
      organizationId,
      bookingId: 'BK-2026-002',
      clientName: 'Ngozi Nwosu',
      amountKobo: 2_450_000_00,
      channel: 'Paystack Direct Checkout',
      reference: 'PSTK-918204-NG',
      receivedAt: '2026-11-01 16:45 WAT',
      recordedBy: 'Tunde Bakare',
      recordedByUserId: 'usr_tunde',
      status: 'Confirmed',
    },
    {
      paymentId: 'PAY-2026-003',
      organizationId,
      bookingId: 'BK-2026-003',
      clientName: 'Folake Ogunleye',
      amountKobo: 350_000_00,
      channel: 'Direct Debit Mandate',
      reference: 'DD-ZENITH-81729',
      receivedAt: '2026-11-02 08:15 WAT',
      recordedBy: 'Adaeze Okafor',
      recordedByUserId: 'usr_adaeze',
      status: 'Confirmed',
    },
  ]);

  return {
    success: true,
    database: mongoose.connection.name,
    agencyName: org.name,
    owner: {
      name: owner.name,
      email: owner.email,
      role: owner.roleLabel,
    },
    staff: [
      {
        name: staff1.name,
        email: staff1.email,
        role: staff1.roleLabel,
      },
      {
        name: staff2.name,
        email: staff2.email,
        role: staff2.roleLabel,
      },
    ],
    clientsCount: clients.length,
    leadsCount: leads.length,
    bookingsCount: bookings.length,
    paymentsCount: payments.length,
  };
}
