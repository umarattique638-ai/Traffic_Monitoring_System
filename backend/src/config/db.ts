import dns from 'node:dns';
import mongoose from 'mongoose';
import { env } from './env.js';

// Some routers/ISPs cannot answer the SRV lookup that "mongodb+srv://" needs.
// In development, ask public DNS servers instead.
if (!env.isProd) {
  dns.setServers(['1.1.1.1', '8.8.8.8']);
}

export async function connectDB(): Promise<void> {
  await mongoose.connect(env.mongoUrl);
  console.log('MongoDB connected');

  mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected'));
  mongoose.connection.on('error', (err) => console.error('MongoDB error:', err));
}
