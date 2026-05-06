import mongoose from 'mongoose';

export interface ITask {
  _id: string;
  title: string;
  description?: string;
  status: 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  projectId: string;
  assigneeId?: string;
  reporterId: string;
  organizationId: string;
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const taskSchema = new mongoose.Schema<ITask>({
  title: { type: String, required: true },
  description: { type: String },
  status: { type: String, enum: ['backlog', 'todo', 'in_progress', 'review', 'done'], default: 'backlog' },
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  projectId: { type: String, required: true, index: true },
  assigneeId: { type: String, index: true },
  reporterId: { type: String, required: true },
  organizationId: { type: String, required: true, index: true },
  dueDate: { type: Date },
}, { timestamps: true });

export const Task = mongoose.model<ITask>('Task', taskSchema);
