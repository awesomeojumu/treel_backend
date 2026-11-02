import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';
import { UserModel } from '@/models';

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
  // Fall back
}

async function run() {
  console.log('Connecting to MongoDB Atlas to delete all users...');
  const uri = process.env.MONGODB_URI || process.env.DATABASE_URL;
  if (!uri) throw new Error('MONGODB_URI environment variable is required');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });

  const result = await UserModel.deleteMany({});
  console.log(`Deleted ${result.deletedCount} users from the "users" collection.`);

  const remaining = await UserModel.countDocuments();
  console.log(`Remaining users count: ${remaining}`);

  await mongoose.disconnect();
  console.log('Done!');
  process.exit(0);
}

run().catch((err) => {
  console.error('Error deleting users:', err);
  process.exit(1);
});
