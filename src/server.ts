import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';
import { buildApp } from '@/app';

// Configure public DNS resolution for Atlas SRV queries on Windows
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
  // Fall back to system resolver
}

async function start() {
  const app = await buildApp();
  const port = Number(process.env.PORT ?? 4000);
  const host = process.env.HOST ?? '0.0.0.0';

  const mongoUri = process.env.MONGODB_URI || process.env.DATABASE_URL;
  if (mongoUri) {
    try {
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
      app.log.info(`Connected to MongoDB Atlas database: ${mongoose.connection.name}`);
    } catch (err: any) {
      app.log.warn(`MongoDB Atlas connection notice: ${err.message}. Running in resilient local/offline mode.`);
    }
  }

  try {
    await app.listen({ port, host });
    app.log.info(`TravelReel API listening on http://${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
