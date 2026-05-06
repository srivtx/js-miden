import mongoose from 'mongoose';

export interface IProject {
  _id: string;
  name: string;
  description?: string;
  organizationId: string;
  ownerId: string;
  status: 'active' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new mongoose.Schema<IProject>({
  name: { type: String, required: true },
  description: { type: String },
  organizationId: { type: String, required: true, index: true },
  ownerId: { type: String, required: true },
  status: { type: String, enum: ['active', 'archived'], default: 'active' },
}, { timestamps: true });

export const Project = mongoose.model<IProject>('Project', projectSchema);
