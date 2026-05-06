import mongoose from 'mongoose';

export interface IOrganization {
  _id: string;
  name: string;
  slug: string;
  plan: 'free' | 'pro' | 'enterprise';
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus: 'active' | 'trialing' | 'past_due' | 'canceled';
  createdAt: Date;
  updatedAt: Date;
}

const organizationSchema = new mongoose.Schema<IOrganization>({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  plan: { type: String, enum: ['free', 'pro', 'enterprise'], default: 'free' },
  stripeCustomerId: { type: String },
  stripeSubscriptionId: { type: String },
  subscriptionStatus: { type: String, enum: ['active', 'trialing', 'past_due', 'canceled'], default: 'trialing' },
}, { timestamps: true });

export const Organization = mongoose.model<IOrganization>('Organization', organizationSchema);
