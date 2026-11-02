import mongoose from 'mongoose';
import {
  ClientModel,
  LeadModel,
  BookingModel,
  PaymentModel,
} from '@/models';

export async function cleanDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is required to clean the database.');
  }

  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(uri, {
      dbName: 'Treel',
    });
  }

  // Wipe operational CRM collections
  const deletedClients = await ClientModel.deleteMany({});
  const deletedLeads = await LeadModel.deleteMany({});
  const deletedBookings = await BookingModel.deleteMany({});
  const deletedPayments = await PaymentModel.deleteMany({});

  return {
    database: mongoose.connection.name,
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

if (require.main === module) {
  cleanDatabase()
    .then((result) => {
      console.log('Database clean complete:', JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error('Error cleaning database:', err);
      process.exit(1);
    });
}
