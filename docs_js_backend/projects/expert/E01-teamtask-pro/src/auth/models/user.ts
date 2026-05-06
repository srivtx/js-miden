import mongoose from 'mongoose';

export interface IUser {
  _id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  organizationId: string;
  role: 'owner' | 'admin' | 'member';
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new mongoose.Schema<IUser>({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  organizationId: { type: String, required: true, index: true },
  role: { type: String, enum: ['owner', 'admin', 'member'], default: 'member' },
}, { timestamps: true });

export const User = mongoose.model<IUser>('User', userSchema);
