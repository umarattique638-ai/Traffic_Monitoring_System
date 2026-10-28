import { Schema, model } from 'mongoose';

// Named counters. "site" hands out the numeric site ids (ClickHouse needs numbers, not ObjectIds).
interface ICounter {
  _id: string;
  value: number;
}

const counterSchema = new Schema<ICounter>({
  _id: { type: String, required: true },
  value: { type: Number, required: true },
});

export const Counter = model<ICounter>('Counter', counterSchema);
