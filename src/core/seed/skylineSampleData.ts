/**
 * Canonical Nigerian Sample Data from Section 10 of the TravelReel Figma Design Brief
 * - Agency: Skyline Travels and Tours Ltd, Ikeja, Lagos; RC 1234567
 * - Staff: Adaeze Okafor (owner), Tunde Bakare (operations manager), Halima Yusuf, Chinedu Eze and Bisi Adeyemi (sales agents), Musa Ibrahim (visa officer)
 * - Clients: Ngozi Nwosu, Ibrahim Abdullahi, Folake Ogunleye, the Ojo family (group of 4), Grace Church Abuja (group of 32)
 * - Bookings: Lagos to London return (₦2,450,000.00), Dubai package for 2 (₦4,180,000.00), UK visa assistance (₦350,000.00), Umrah group, 32 pilgrims (₦98,560,000.00)
 */

export const SKYLINE_SAMPLE_AGENCY = {
  organizationId: 'org_skyline_lagos',
  name: 'Skyline Travels and Tours Ltd',
  rcNumber: 'RC 1234567',
  branch: 'Ikeja, Lagos',
  countryCode: 'NG' as const,
  baseCurrency: 'NGN' as const,
  vatRatePercent: 7.5,
};

export const SKYLINE_SAMPLE_STAFF = [
  {
    userId: 'usr_adaeze',
    name: 'Adaeze Okafor',
    initials: 'AO',
    roleKey: 'OWNER' as const,
    roleLabel: 'Owner',
    branch: 'Ikeja, Lagos',
    status: 'Clocked in 08:02',
    salesMonthKobo: 4_180_000_00,
    collectedMonthKobo: 3_200_000_00,
    bookingsCount: 4,
  },
  {
    userId: 'usr_tunde',
    name: 'Tunde Bakare',
    initials: 'TB',
    roleKey: 'OPERATIONS_MANAGER' as const,
    roleLabel: 'Operations manager',
    branch: 'Ikeja, Lagos',
    status: 'Clocked in 08:15',
    salesMonthKobo: 2_450_000_00,
    collectedMonthKobo: 2_450_000_00,
    bookingsCount: 3,
  },
  {
    userId: 'usr_halima',
    name: 'Halima Yusuf',
    initials: 'HY',
    roleKey: 'SALES_AGENT' as const,
    roleLabel: 'Sales agent',
    branch: 'Ikeja, Lagos',
    status: 'Clocked in 08:24',
    salesMonthKobo: 3_300_000_00,
    collectedMonthKobo: 2_150_000_00,
    bookingsCount: 6,
  },
  {
    userId: 'usr_chinedu',
    name: 'Chinedu Eze',
    initials: 'CE',
    roleKey: 'SALES_AGENT' as const,
    roleLabel: 'Sales agent',
    branch: 'Ikeja, Lagos',
    status: 'Clocked in 08:30',
    salesMonthKobo: 1_850_000_00,
    collectedMonthKobo: 1_300_000_00,
    bookingsCount: 5,
  },
  {
    userId: 'usr_bisi',
    name: 'Bisi Adeyemi',
    initials: 'BA',
    roleKey: 'SALES_AGENT' as const,
    roleLabel: 'Sales agent',
    branch: 'Ikeja, Lagos',
    status: 'Field visit',
    salesMonthKobo: 850_000_00,
    collectedMonthKobo: 300_000_00,
    bookingsCount: 2,
  },
  {
    userId: 'usr_musa',
    name: 'Musa Ibrahim',
    initials: 'MI',
    roleKey: 'TICKETING_VISA_OFFICER' as const,
    roleLabel: 'Visa officer',
    branch: 'Ikeja, Lagos',
    status: 'Clocked in 08:10',
    salesMonthKobo: 350_000_00,
    collectedMonthKobo: 350_000_00,
    bookingsCount: 4,
  },
];

export const SKYLINE_SAMPLE_BOOKINGS = [
  {
    id: 'BK-2026-014',
    title: 'Lagos to London return',
    clientName: 'Ngozi Nwosu',
    clientPhone: '+234 803 123 4567',
    type: 'Flight',
    soldBy: 'Halima Yusuf',
    status: 'Paid' as const,
    totalKobo: 2_450_000_00,
    paidKobo: 2_450_000_00,
    owedKobo: 0,
    supplierCostUsdCents: 124_000, // $1,240.00
    storedExchangeRate: 1_500, // ₦1,860,000.00
    dateLabel: '14 Nov 2026',
  },
  {
    id: 'BK-2026-015',
    title: 'Dubai package for 2',
    clientName: 'the Ojo family (group of 4)',
    clientPhone: '+234 802 998 1122',
    type: 'Package',
    soldBy: 'Adaeze Okafor',
    status: 'Part-paid' as const,
    totalKobo: 4_180_000_00,
    paidKobo: 2_500_000_00,
    owedKobo: 1_680_000_00,
    dateLabel: '18 Nov 2026',
  },
  {
    id: 'BK-2026-016',
    title: 'Kigali conference flight and hotel',
    clientName: 'Ibrahim Abdullahi',
    clientPhone: '+234 809 445 7788',
    type: 'Flight and hotel',
    soldBy: 'Bisi Adeyemi',
    status: 'Part-paid' as const,
    totalKobo: 850_000_00, // W1 acceptance test booking: ₦850,000.00
    paidKobo: 300_000_00, // ₦300,000.00 transfer with proof
    owedKobo: 550_000_00, // ₦550,000.00 owed
    dateLabel: '20 Nov 2026',
  },
  {
    id: 'BK-2026-017',
    title: 'UK visa assistance',
    clientName: 'Folake Ogunleye',
    clientPhone: '+234 805 334 9012',
    type: 'Visa',
    soldBy: 'Musa Ibrahim',
    status: 'Paid' as const,
    totalKobo: 350_000_00,
    paidKobo: 350_000_00,
    owedKobo: 0,
    dateLabel: '22 Nov 2026',
  },
  {
    id: 'BK-2026-018',
    title: 'Umrah group, 32 pilgrims',
    clientName: 'Grace Church Abuja (group of 32)',
    clientPhone: '+234 806 771 2345',
    type: 'Group departure',
    soldBy: 'Chinedu Eze',
    status: 'Part-paid' as const,
    totalKobo: 98_560_000_00,
    paidKobo: 64_000_000_00,
    owedKobo: 34_560_000_00,
    dateLabel: '12 Dec 2026',
  },
];
