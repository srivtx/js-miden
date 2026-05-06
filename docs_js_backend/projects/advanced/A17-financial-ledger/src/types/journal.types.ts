export interface AuditLog {
  id: string;
  entityType: 'transaction' | 'account' | 'journal_entry';
  entityId: string;
  action: 'created' | 'updated' | 'posted' | 'reversed';
  performedBy: string;
  timestamp: Date;
  hash: string;
  previousHash: string;
  details: Record<string, unknown>;
}
