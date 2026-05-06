export interface Job {
  id: string;
  type: string;
  payload: object;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'dead';
  progress: number;
  result?: object;
  error?: string;
  attempt_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateJobRequest {
  type: string;
  payload: object;
}

export interface JobProgress {
  jobId: string;
  progress: number;
}
