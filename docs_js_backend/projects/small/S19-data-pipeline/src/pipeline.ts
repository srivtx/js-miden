import { parse } from 'csv-parse/sync';
import { v4 as uuid } from 'uuid';

interface PipelineStatus {
  id: string;
  status: 'running' | 'completed' | 'failed';
  recordsProcessed: number;
  recordsFailed: number;
  errors: string[];
  startedAt: string;
  completedAt?: string;
}

interface Record {
  id: string;
  name: string;
  email: string;
  age: number;
}

const pipelines: Map<string, PipelineStatus> = new Map();
// BUG: Not idempotent - processed records stored without deduplication
const processedRecords: Map<string, Record[]> = new Map();

export async function runPipeline(source: string, destination: string): Promise<string> {
  const pipelineId = uuid();
  const status: PipelineStatus = {
    id: pipelineId,
    status: 'running',
    recordsProcessed: 0,
    recordsFailed: 0,
    errors: [],
    startedAt: new Date().toISOString(),
  };
  pipelines.set(pipelineId, status);
  
  try {
    // Extract
    const csvData = await extract(source);
    
    // Transform
    const transformed = transform(csvData);
    
    // Load
    // BUG: No error isolation - one bad row fails entire batch
    await load(destination, transformed, pipelineId);
    
    status.status = 'completed';
    status.completedAt = new Date().toISOString();
  } catch (error) {
    status.status = 'failed';
    status.errors.push(error instanceof Error ? error.message : String(error));
    status.completedAt = new Date().toISOString();
  }
  
  return pipelineId;
}

export function getPipelineStatus(id: string): PipelineStatus | undefined {
  return pipelines.get(id);
}

async function extract(source: string): Promise<string> {
  // Simulated CSV extraction
  return `id,name,email,age
1,Alice,alice@example.com,30
2,Bob,bob@example.com,25
3,Charlie,charlie@example,invalid
4,Dave,dave@example.com,35`;
}

function transform(data: string): Record[] {
  const records = parse(data, {
    columns: true,
    skip_empty_lines: true,
  });
  
  return records.map((row: Record<string, string>) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    age: parseInt(row.age, 10),
  }));
}

async function load(destination: string, records: Record[], pipelineId: string): Promise<void> {
  // BUG: No error isolation - one invalid record throws and fails the whole batch
  for (const record of records) {
    validateRecord(record);
  }
  
  // BUG: Not idempotent - just appends records
  const existing = processedRecords.get(destination) || [];
  processedRecords.set(destination, [...existing, ...records]);
  
  const status = pipelines.get(pipelineId);
  if (status) {
    status.recordsProcessed += records.length;
  }
}

function validateRecord(record: Record): void {
  if (!record.email.includes('@')) {
    throw new Error(`Invalid email: ${record.email}`);
  }
  if (isNaN(record.age) || record.age < 0) {
    throw new Error(`Invalid age: ${record.age}`);
  }
}

// Helper to check idempotency
export function getDestinationRecords(destination: string): Record[] {
  return processedRecords.get(destination) || [];
}
