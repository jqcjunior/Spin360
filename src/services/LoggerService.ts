export interface LogParams {
  module: string;
  action: string;
  error?: any;
  metadata?: any;
  timestamp: string;
}

export class LoggerService {
  static log(params: { module: string; action: string; error?: any; metadata?: any }) {
    console.log(
      `[LOG][${params.module}][${params.action}][${new Date().toISOString()}]`,
      params.metadata ? JSON.stringify(params.metadata, null, 2) : '',
      params.error || ''
    );
  }

  static error(params: { module: string; action: string; error?: any; metadata?: any }) {
    console.error(
      `[ERROR][${params.module}][${params.action}][${new Date().toISOString()}]`,
      params.error || '',
      params.metadata ? JSON.stringify(params.metadata, null, 2) : ''
    );
  }
}
