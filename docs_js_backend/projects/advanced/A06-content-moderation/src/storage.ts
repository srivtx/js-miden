import { ContentItem, AIResult, HumanDecision } from './content.js';
import { HumanReviewQueueItem } from './human-review.js';
import { Appeal } from './appeal.js';
import { AuditLog } from './audit.js';
import { QueueJob } from './queue.js';

class MemoryStorage {
  private content = new Map<string, ContentItem>();
  private reviewQueue: HumanReviewQueueItem[] = [];
  private appeals: Appeal[] = [];
  private auditLogs: AuditLog[] = [];
  private queueJobs: QueueJob[] = [];

  async saveContent(item: ContentItem): Promise<void> {
    this.content.set(item.id, item);
  }

  async getContent(id: string): Promise<ContentItem | null> {
    return this.content.get(id) || null;
  }

  async getAllContent(): Promise<ContentItem[]> {
    return Array.from(this.content.values());
  }

  async updateContent(id: string, updates: Partial<ContentItem>): Promise<ContentItem | null> {
    const existing = this.content.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates };
    this.content.set(id, updated);
    return updated;
  }

  async saveReviewQueueItem(item: HumanReviewQueueItem): Promise<void> {
    this.reviewQueue.push(item);
  }

  async getPendingReviewQueueItems(): Promise<HumanReviewQueueItem[]> {
    return this.reviewQueue.filter(i => i.status === 'pending');
  }

  async saveAppeal(appeal: Appeal): Promise<void> {
    const idx = this.appeals.findIndex(a => a.id === appeal.id);
    if (idx >= 0) {
      this.appeals[idx] = appeal;
    } else {
      this.appeals.push(appeal);
    }
  }

  async getAppeal(id: string): Promise<Appeal | null> {
    return this.appeals.find(a => a.id === id) || null;
  }

  async getAppealsForContent(contentId: string): Promise<Appeal[]> {
    return this.appeals.filter(a => a.contentId === contentId);
  }

  async addAuditLog(log: AuditLog): Promise<void> {
    this.auditLogs.push(log);
  }

  async getAuditTrail(contentId: string): Promise<AuditLog[]> {
    return this.auditLogs
      .filter(l => l.contentId === contentId)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  async saveQueueJob(job: QueueJob): Promise<void> {
    const idx = this.queueJobs.findIndex(j => j.id === job.id);
    if (idx >= 0) {
      this.queueJobs[idx] = job;
    } else {
      this.queueJobs.push(job);
    }
  }

  // Test helpers
  clear(): void {
    this.content.clear();
    this.reviewQueue = [];
    this.appeals = [];
    this.auditLogs = [];
    this.queueJobs = [];
  }
}

export const storage = new MemoryStorage();
