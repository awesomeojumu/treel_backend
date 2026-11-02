import 'dotenv/config';
import { seedLiveDatabase } from '@/core/database/seedDatabase';
import mongoose from 'mongoose';

async function run() {
  console.log('Seeding MongoDB Atlas cluster with 1 Owner and 2 Staff...');
  try {
    const result = await seedLiveDatabase();
    console.log('LIVE DATABASE SEEDED SUCCESSFULLY!');
    console.log(JSON.stringify(result, null, 2));
    await mongoose.disconnect();
    process.exit(0);
  } catch (err: any) {
    console.error('Seeding error:', err);
    process.exit(1);
  }
}

run();
