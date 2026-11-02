import mongoose, { Schema, Document, Model } from 'mongoose';

// -----------------------------------------------------------------------------
// 1. Organization / Agency Model
// -----------------------------------------------------------------------------
export interface IOrganization extends Document {
  organizationId: string;
  name: string;
  rcNumber: string;
  branch: string;
  countryCode: string;
  baseCurrency: string;
  vatRatePercent: number;
  ownerUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

const OrganizationSchema = new Schema<IOrganization>(
  {
    organizationId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    rcNumber: { type: String, required: true },
    branch: { type: String, required: true },
    countryCode: { type: String, default: 'NG' },
    baseCurrency: { type: String, default: 'NGN' },
    vatRatePercent: { type: Number, default: 7.5 },
    ownerUserId: { type: String, required: true },
  },
  { timestamps: true, collection: 'organizations' }
);

// -----------------------------------------------------------------------------
// 2. User / Staff Model (1 Owner, 2 Staff)
// -----------------------------------------------------------------------------
export interface IUser extends Document {
  userId: string;
  organizationId: string;
  name: string;
  email: string;
  passwordHash: string;
  initials: string;
  roleKey: 'OWNER' | 'OPERATIONS_MANAGER' | 'SALES_AGENT' | 'TICKETING_VISA_OFFICER' | 'ACCOUNTANT';
  roleLabel: string;
  branch: string;
  phone: string;
  statusText: string;
  isLive: boolean;
  bookingsCount: number;
  salesMonthKobo: number;
  collectedMonthKobo: number;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    organizationId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    initials: { type: String, required: true },
    roleKey: { type: String, required: true },
    roleLabel: { type: String, required: true },
    branch: { type: String, default: 'Ikeja, Lagos' },
    phone: { type: String, default: '+234 803 000 0000' },
    statusText: { type: String, default: 'Clocked in 08:00' },
    isLive: { type: Boolean, default: true },
    bookingsCount: { type: Number, default: 0 },
    salesMonthKobo: { type: Number, default: 0 },
    collectedMonthKobo: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'users' }
);

// -----------------------------------------------------------------------------
// 3. Client Model
// -----------------------------------------------------------------------------
export interface IClient extends Document {
  clientId: string;
  organizationId: string;
  name: string;
  phone: string;
  email: string;
  tag: string;
  ownerName: string;
  ownerUserId: string;
  passportMasked: string;
  passportExpiry: string;
  createdAt: Date;
  updatedAt: Date;
}

const ClientSchema = new Schema<IClient>(
  {
    clientId: { type: String, required: true, unique: true, index: true },
    organizationId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    phone: { type: String, required: true, index: true },
    email: { type: String, default: '' },
    tag: { type: String, default: 'Individual' },
    ownerName: { type: String, required: true },
    ownerUserId: { type: String, required: true, index: true },
    passportMasked: { type: String, default: 'A12••••••' },
    passportExpiry: { type: String, default: '2028-12-31' },
  },
  { timestamps: true, collection: 'clients' }
);

// -----------------------------------------------------------------------------
// 4. Lead Model
// -----------------------------------------------------------------------------
export interface ILead extends Document {
  leadId: string;
  organizationId: string;
  clientId: string;
  clientName: string;
  phone: string;
  requestSummary: string;
  source: string;
  stage: string;
  ownerName: string;
  ownerUserId: string;
  valueKobo: number;
  followUpLabel: string;
  convertedBookingId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const LeadSchema = new Schema<ILead>(
  {
    leadId: { type: String, required: true, unique: true, index: true },
    organizationId: { type: String, required: true, index: true },
    clientId: { type: String, required: true },
    clientName: { type: String, required: true },
    phone: { type: String, required: true },
    requestSummary: { type: String, required: true },
    source: { type: String, default: 'WhatsApp' },
    stage: { type: String, default: 'New' },
    ownerName: { type: String, required: true },
    ownerUserId: { type: String, required: true },
    valueKobo: { type: Number, required: true, default: 0 },
    followUpLabel: { type: String, default: 'Today' },
    convertedBookingId: { type: String },
  },
  { timestamps: true, collection: 'leads' }
);

// -----------------------------------------------------------------------------
// 5. Booking Model
// -----------------------------------------------------------------------------
export interface IBookingItem {
  id: string;
  type: string;
  title: string;
  costKobo: number;
  priceKobo: number;
}

export interface IBooking extends Document {
  bookingId: string;
  organizationId: string;
  title: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  leadId?: string;
  type: string;
  soldBy: string;
  soldByUserId: string;
  status: string;
  items: IBookingItem[];
  totalKobo: number;
  paidKobo: number;
  owedKobo: number;
  dateLabel: string;
  entryOrigin: string;
  createdAt: Date;
  updatedAt: Date;
}

const BookingSchema = new Schema<IBooking>(
  {
    bookingId: { type: String, required: true, unique: true, index: true },
    organizationId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    clientId: { type: String, required: true, index: true },
    clientName: { type: String, required: true },
    clientPhone: { type: String, required: true },
    leadId: { type: String },
    type: { type: String, default: 'Flight' },
    soldBy: { type: String, required: true },
    soldByUserId: { type: String, required: true, index: true },
    status: { type: String, default: 'Confirmed' },
    items: [
      {
        id: { type: String },
        type: { type: String },
        title: { type: String },
        costKobo: { type: Number, default: 0 },
        priceKobo: { type: Number, default: 0 },
      },
    ],
    totalKobo: { type: Number, required: true, default: 0 },
    paidKobo: { type: Number, required: true, default: 0 },
    owedKobo: { type: Number, required: true, default: 0 },
    dateLabel: { type: String, required: true },
    entryOrigin: { type: String, default: 'FROM_LEAD' },
  },
  { timestamps: true, collection: 'bookings' }
);

// -----------------------------------------------------------------------------
// 6. Payment Model
// -----------------------------------------------------------------------------
export interface IPayment extends Document {
  paymentId: string;
  organizationId: string;
  bookingId: string;
  clientName: string;
  amountKobo: number;
  channel: string;
  reference: string;
  receivedAt: string;
  recordedBy: string;
  recordedByUserId: string;
  proofFileName?: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    paymentId: { type: String, required: true, unique: true, index: true },
    organizationId: { type: String, required: true, index: true },
    bookingId: { type: String, required: true, index: true },
    clientName: { type: String, required: true },
    amountKobo: { type: Number, required: true },
    channel: { type: String, default: 'Direct Bank Transfer' },
    reference: { type: String, required: true, unique: true, index: true },
    receivedAt: { type: String, required: true },
    recordedBy: { type: String, required: true },
    recordedByUserId: { type: String, required: true },
    proofFileName: { type: String },
    status: { type: String, default: 'Confirmed' },
  },
  { timestamps: true, collection: 'payments' }
);

// Register and export models (avoid re-compilation in hot reloading)
export const OrganizationModel: Model<IOrganization> =
  mongoose.models.Organization || mongoose.model<IOrganization>('Organization', OrganizationSchema);

export const UserModel: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export const ClientModel: Model<IClient> =
  mongoose.models.Client || mongoose.model<IClient>('Client', ClientSchema);

export const LeadModel: Model<ILead> =
  mongoose.models.Lead || mongoose.model<ILead>('Lead', LeadSchema);

export const BookingModel: Model<IBooking> =
  mongoose.models.Booking || mongoose.model<IBooking>('Booking', BookingSchema);

export const PaymentModel: Model<IPayment> =
  mongoose.models.Payment || mongoose.model<IPayment>('Payment', PaymentSchema);
