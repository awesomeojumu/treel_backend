import { PermissionFlag } from '@/core/permissions/flags';
import { ModuleKey } from '@/core/platform/layers';

/**
 * Section 4: Pages, modules and phases
 * The product has 34 pages (29 app pages + 5 public website pages).
 * Each page holds its functions as tabs, side drawers and pop-ups,
 * so a user stays on one page to list, open and add.
 */

export type BuildPhase = 'P0' | 'P1' | 'P1_P2' | 'P2' | 'P2_P4' | 'P3' | 'P4' | 'AFTER_P4';
export type PagePlatformTarget = 'BOTH' | 'WEB' | 'WEB_ONLY_NEVER_MOBILE';

export interface PageSpecification {
  pageNumber: number;
  slug: string;
  routePath: string;
  name: string;
  tabs: string[];
  drawersAndPopups: string[];
  platform: PagePlatformTarget;
  phase: BuildPhase;
  requiredFlag?: PermissionFlag;
  moduleKey?: ModuleKey;
}

export const PAGES_REGISTRY: PageSpecification[] = [
  {
    pageNumber: 1,
    slug: 'auth',
    routePath: '/auth/sign-in',
    name: 'Auth',
    tabs: ['Sign in', 'Sign up', 'Forgot password', 'Accept invite'],
    drawersAndPopups: ['2FA entry'],
    platform: 'BOTH',
    phase: 'P0',
  },
  {
    pageNumber: 2,
    slug: 'setup',
    routePath: '/setup',
    name: 'Setup',
    tabs: [
      'Business type',
      'Company',
      'Branches',
      'Currency and VAT',
      'Modules',
      'Invite staff',
      'Policies',
    ],
    drawersAndPopups: [],
    platform: 'WEB',
    phase: 'P1',
    requiredFlag: 'settings.manage',
  },
  {
    pageNumber: 3,
    slug: 'home',
    routePath: '/',
    name: 'Home',
    tabs: ['Overview', 'Staff live', 'Alerts'],
    drawersAndPopups: ['Quick add (sale, lead, expense)', 'Staff quick view'],
    platform: 'BOTH',
    phase: 'P0',
    requiredFlag: 'home.view',
  },
  {
    pageNumber: 4,
    slug: 'my-day',
    routePath: '/my-day',
    name: 'My Day',
    tabs: ['Today (clock-in, schedule, hourly log)', 'My tasks', 'My scorecard', 'My queries'],
    drawersAndPopups: ['Add log', 'Respond to query'],
    platform: 'BOTH',
    phase: 'P1_P2',
    requiredFlag: 'my_day.use',
    moduleKey: 'staff_attendance',
  },
  {
    pageNumber: 5,
    slug: 'team',
    routePath: '/team',
    name: 'Team',
    tabs: ['Live grid', 'Staff', 'Attendance', 'Leave', 'Directory'],
    drawersAndPopups: ['Staff detail', 'Invite', 'Leave request'],
    platform: 'BOTH',
    phase: 'P0',
    requiredFlag: 'staff.activity.view',
    moduleKey: 'staff_attendance',
  },
  {
    pageNumber: 6,
    slug: 'clients',
    routePath: '/clients',
    name: 'Clients',
    tabs: ['List', 'Duplicates'],
    drawersAndPopups: [
      'Client profile (Details, KYC and documents, Bookings, Payments, Notes)',
      'Add client',
      'KYC capture',
      'Document viewer',
    ],
    platform: 'BOTH',
    phase: 'P0',
    requiredFlag: 'clients.view',
    moduleKey: 'clients',
  },
  {
    pageNumber: 7,
    slug: 'leads',
    routePath: '/leads',
    name: 'Leads',
    tabs: ['Pipeline', 'List', 'Follow-ups', 'Sources'],
    drawersAndPopups: ['Lead detail', 'Add lead', 'Convert'],
    platform: 'BOTH',
    phase: 'P0',
    requiredFlag: 'leads.view',
    moduleKey: 'leads',
  },
  {
    pageNumber: 8,
    slug: 'quotes-invoices',
    routePath: '/quotes-invoices',
    name: 'Quotes and invoices',
    tabs: ['Quotes', 'Invoices', 'Outstanding'],
    drawersAndPopups: ['Quote builder', 'Preview and share', 'Record payment', 'Receipt'],
    platform: 'BOTH',
    phase: 'P1',
    requiredFlag: 'quotes.view',
    moduleKey: 'quotes',
  },
  {
    pageNumber: 9,
    slug: 'bookings',
    routePath: '/bookings',
    name: 'Bookings',
    tabs: ['Active', 'Pending payment', 'Completed', 'Cancelled'],
    drawersAndPopups: [
      'Booking detail (Summary, Items, Payments, Tickets, Documents, Tasks, Timeline)',
      'New booking',
      'Cancel and refund',
    ],
    platform: 'BOTH',
    phase: 'P0',
    requiredFlag: 'bookings.view',
    moduleKey: 'bookings',
  },
  {
    pageNumber: 10,
    slug: 'finance',
    routePath: '/finance',
    name: 'Finance',
    tabs: ['Dashboard', 'Payments', 'Reconciliation', 'Expenses', 'Accounts'],
    drawersAndPopups: [
      'Capture payment',
      'Proof upload',
      'Add expense',
      'Daily cash summary',
    ],
    platform: 'BOTH',
    phase: 'P0',
    requiredFlag: 'payments.view',
    moduleKey: 'payments',
  },
  {
    pageNumber: 11,
    slug: 'approvals',
    routePath: '/approvals',
    name: 'Approvals',
    tabs: ['Queue', 'My requests', 'Limits', 'Retirement'],
    drawersAndPopups: ['New imprest', 'Approval detail'],
    platform: 'BOTH',
    phase: 'P2',
    requiredFlag: 'approvals.view',
    moduleKey: 'approvals',
  },
  {
    pageNumber: 12,
    slug: 'tickets-visas',
    routePath: '/tickets-visas',
    name: 'Tickets and visas',
    tabs: ['Ticket pool', 'Departures', 'Visa tracker', 'Extra services'],
    drawersAndPopups: ['Ticket detail', 'Issue ticket', 'Visa case with checklist'],
    platform: 'BOTH',
    phase: 'P2',
    requiredFlag: 'tickets.view',
    moduleKey: 'tickets',
  },
  {
    pageNumber: 13,
    slug: 'suppliers',
    routePath: '/suppliers',
    name: 'Suppliers',
    tabs: ['Suppliers', 'Amounts owed', 'Payments'],
    drawersAndPopups: ['Supplier profile', 'Supplier payment', 'Rating'],
    platform: 'BOTH',
    phase: 'P2',
    requiredFlag: 'suppliers.view',
    moduleKey: 'suppliers',
  },
  {
    pageNumber: 14,
    slug: 'tasks-queries',
    routePath: '/tasks-queries',
    name: 'Tasks and queries',
    tabs: ['Tasks', 'Queries', 'Disputes'],
    drawersAndPopups: ['Task detail', 'Assign', 'Raise query', 'Thread', 'Dispute review'],
    platform: 'BOTH',
    phase: 'P2',
    requiredFlag: 'tasks.view',
    moduleKey: 'tasks',
  },
  {
    pageNumber: 15,
    slug: 'performance',
    routePath: '/performance',
    name: 'Performance',
    tabs: ['Scorecards', 'Commission', 'Appraisals'],
    drawersAndPopups: ['Appraisal', 'Self-assessment', 'Sign-off'],
    platform: 'BOTH',
    phase: 'P2_P4',
    requiredFlag: 'scorecards.view',
    moduleKey: 'performance',
  },
  {
    pageNumber: 16,
    slug: 'group-travel',
    routePath: '/group-travel',
    name: 'Group travel',
    tabs: ['Packages', 'Departures', 'Group bookings', 'Departure day', 'Profitability'],
    drawersAndPopups: [
      'Package builder',
      'Manifest',
      'Rooming list',
      'Check-in',
      'Incident log',
    ],
    platform: 'BOTH',
    phase: 'P3',
    requiredFlag: 'groups.view',
    moduleKey: 'groups',
  },
  {
    pageNumber: 17,
    slug: 'events',
    routePath: '/events',
    name: 'Events',
    tabs: ['Events', 'Calendar'],
    drawersAndPopups: ['Event workspace', 'QR scanner'],
    platform: 'BOTH',
    phase: 'AFTER_P4',
  },
  {
    pageNumber: 18,
    slug: 'reports',
    routePath: '/reports',
    name: 'Reports',
    tabs: ['Hub', 'Exports', 'Scheduled'],
    drawersAndPopups: ['Filters', 'Export'],
    platform: 'WEB',
    phase: 'P2_P4',
    requiredFlag: 'reports.view',
    moduleKey: 'reports',
  },
  {
    pageNumber: 19,
    slug: 'documents',
    routePath: '/documents',
    name: 'Documents',
    tabs: ['Library', 'Policies', 'Templates'],
    drawersAndPopups: ['Upload', 'Acknowledge', 'Edit template'],
    platform: 'BOTH',
    phase: 'P2',
    requiredFlag: 'documents.view',
    moduleKey: 'documents',
  },
  {
    pageNumber: 20,
    slug: 'inbox',
    routePath: '/inbox',
    name: 'Inbox',
    tabs: ['Notifications', 'Support'],
    drawersAndPopups: ['New ticket', 'Share to WhatsApp'],
    platform: 'BOTH',
    phase: 'P1_P2',
  },
  {
    pageNumber: 21,
    slug: 'workspace-settings',
    routePath: '/settings/workspace',
    name: 'Workspace settings',
    tabs: [
      'Organisation',
      'Branches',
      'Roles and permissions',
      'Approval rules',
      'Working hours',
      'Pipeline and custom fields',
      'Templates',
      'Branding',
      'Currency and VAT',
      'Notification rules',
    ],
    drawersAndPopups: ['Edit role', 'Add branch'],
    platform: 'WEB',
    phase: 'P0',
    requiredFlag: 'settings.manage',
  },
  {
    pageNumber: 22,
    slug: 'billing',
    routePath: '/settings/billing',
    name: 'Billing',
    tabs: ['Plan', 'Invoices', 'Payment method', 'Upgrade'],
    drawersAndPopups: ['Change plan'],
    platform: 'WEB_ONLY_NEVER_MOBILE',
    phase: 'P1',
    requiredFlag: 'billing.manage',
  },
  {
    pageNumber: 23,
    slug: 'data-audit',
    routePath: '/settings/data-audit',
    name: 'Data and audit',
    tabs: ['Import', 'Audit log', 'Data export'],
    drawersAndPopups: ['Import mapping', 'Audit detail'],
    platform: 'WEB',
    phase: 'P1_P2',
    requiredFlag: 'audit.view',
  },
  {
    pageNumber: 24,
    slug: 'my-account',
    routePath: '/account',
    name: 'My account',
    tabs: ['Profile', 'Security (2FA, sessions, devices)', 'Preferences', 'Delete account'],
    drawersAndPopups: ['Change password'],
    platform: 'BOTH',
    phase: 'P1',
  },
  {
    pageNumber: 25,
    slug: 'super-admin-tenants',
    routePath: '/super-admin/tenants',
    name: 'Super Admin: Tenants',
    tabs: ['List'],
    drawersAndPopups: [
      'Tenant drawer (Overview, Users, Usage, Billing, Support)',
      'Impersonate',
      'Suspend',
    ],
    platform: 'WEB',
    phase: 'P1',
    requiredFlag: 'platform.tenants.manage',
  },
  {
    pageNumber: 26,
    slug: 'super-admin-plans-billing',
    routePath: '/super-admin/plans-billing',
    name: 'Super Admin: Plans and billing',
    tabs: ['Subscriptions', 'Plans and entitlements', 'Failed payments'],
    drawersAndPopups: ['Edit plan'],
    platform: 'WEB',
    phase: 'P1',
    requiredFlag: 'platform.plans.manage',
  },
  {
    pageNumber: 27,
    slug: 'super-admin-templates-packs',
    routePath: '/super-admin/templates-country-packs',
    name: 'Super Admin: Templates and country packs',
    tabs: ['Business templates', 'Country packs'],
    drawersAndPopups: ['Edit template or pack'],
    platform: 'WEB',
    phase: 'P1',
    requiredFlag: 'platform.templates.manage',
  },
  {
    pageNumber: 28,
    slug: 'super-admin-support-announcements',
    routePath: '/super-admin/support-announcements',
    name: 'Super Admin: Support and announcements',
    tabs: ['Tickets', 'Announcements', 'Data requests'],
    drawersAndPopups: ['Reply', 'Publish'],
    platform: 'WEB',
    phase: 'P1',
    requiredFlag: 'platform.support.manage',
  },
  {
    pageNumber: 29,
    slug: 'super-admin-health-audit',
    routePath: '/super-admin/health-audit',
    name: 'Super Admin: Health and audit',
    tabs: ['Health', 'Platform audit log'],
    drawersAndPopups: ['Event detail'],
    platform: 'WEB',
    phase: 'P4',
    requiredFlag: 'audit.view',
  },
  {
    pageNumber: 30,
    slug: 'public-home',
    routePath: '/site',
    name: 'Public website: Home',
    tabs: ['Home'],
    drawersAndPopups: ['Demo form'],
    platform: 'WEB',
    phase: 'P1',
  },
  {
    pageNumber: 31,
    slug: 'public-features',
    routePath: '/site/features',
    name: 'Public website: Features',
    tabs: ['Features'],
    drawersAndPopups: ['Demo form'],
    platform: 'WEB',
    phase: 'P1',
  },
  {
    pageNumber: 32,
    slug: 'public-pricing',
    routePath: '/site/pricing',
    name: 'Public website: Pricing',
    tabs: ['Pricing'],
    drawersAndPopups: ['Demo form'],
    platform: 'WEB',
    phase: 'P1',
  },
  {
    pageNumber: 33,
    slug: 'public-demo',
    routePath: '/site/book-demo',
    name: 'Public website: Book a demo',
    tabs: ['Book a demo'],
    drawersAndPopups: ['Demo form'],
    platform: 'WEB',
    phase: 'P1',
  },
  {
    pageNumber: 34,
    slug: 'public-security-privacy',
    routePath: '/site/security-privacy',
    name: 'Public website: Security and privacy',
    tabs: ['Security and privacy'],
    drawersAndPopups: [],
    platform: 'WEB',
    phase: 'P1',
  },
];

/**
 * Section 4 & Section 13 App Store Rule:
 * Billing (Page 22) and any plan/price/upgrade screen are strictly forbidden in the mobile app.
 * Mobile only signs in to an existing workspace and includes in-app account deletion (Page 24).
 */
export function assertPageAllowedOnClientPlatform(
  pageNumber: number,
  clientPlatform: 'WEB' | 'MOBILE'
): PageSpecification {
  const page = PAGES_REGISTRY.find((p) => p.pageNumber === pageNumber);
  if (!page) {
    throw new Error(`PAGE_NOT_FOUND: Page #${pageNumber} does not exist in the 34-page registry.`);
  }

  if (clientPlatform === 'MOBILE') {
    if (page.platform === 'WEB_ONLY_NEVER_MOBILE' || page.pageNumber === 22) {
      throw new Error(
        'MOBILE_STORE_POLICY_VIOLATION: The mobile app holds no plan, price or payment screen. Owners subscribe on the web.'
      );
    }
    if (page.platform === 'WEB') {
      throw new Error(
        `MOBILE_UNSUPPORTED_PAGE: Page #${page.pageNumber} (${page.name}) is designed for Web desktop only.`
      );
    }
  }

  return structuredClone(page);
}

/**
 * Section 4 Build Rule:
 * Every drawer and pop-up has its own address and deep link, so the back button works
 * and a booking link can be shared on WhatsApp.
 */
export function buildAddressableDeepLink(params: {
  pageNumber: number;
  tab?: string;
  drawer?: string;
  recordId?: string;
  modal?: string;
}): string {
  const page = PAGES_REGISTRY.find((p) => p.pageNumber === params.pageNumber);
  if (!page) {
    throw new Error(`Unknown pageNumber: ${params.pageNumber}`);
  }

  const query = new URLSearchParams();
  if (params.tab) query.set('tab', params.tab);
  if (params.drawer) query.set('drawer', params.drawer);
  if (params.recordId) query.set('id', params.recordId);
  if (params.modal) query.set('modal', params.modal);

  const qs = query.toString();
  return qs ? `${page.routePath}?${qs}` : page.routePath;
}
