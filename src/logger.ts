import * as fs from 'fs';
import * as path from 'path';

// Vercel (and other serverless platforms) provide a read-only filesystem
// outside of /tmp -- skip file logging there and rely on console output,
// which the platform already captures as function logs.
const IS_SERVERLESS = !!process.env.VERCEL;

const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, `qna-${new Date().toISOString().split('T')[0]}.log`);

if (!IS_SERVERLESS && !fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function appendToLogFile(entry: string) {
  if (IS_SERVERLESS) return;
  fs.appendFileSync(LOG_FILE, entry);
}

export const logger = {
  info: (message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] INFO: ${message}${data ? ' ' + JSON.stringify(data) : ''}\n`;
    console.log(logEntry);
    appendToLogFile(logEntry);
  },

  error: (message: string, error?: any) => {
    const timestamp = new Date().toISOString();
    const errorStr = error ? (error instanceof Error ? error.message : JSON.stringify(error)) : '';
    const logEntry = `[${timestamp}] ERROR: ${message}${errorStr ? ' - ' + errorStr : ''}\n`;
    console.error(logEntry);
    appendToLogFile(logEntry);
  },

  debug: (message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] DEBUG: ${message}${data ? ' ' + JSON.stringify(data) : ''}\n`;
    console.log(logEntry);
    appendToLogFile(logEntry);
  },

  warn: (message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] WARN: ${message}${data ? ' ' + JSON.stringify(data) : ''}\n`;
    console.warn(logEntry);
    appendToLogFile(logEntry);
  },

  getLogFile: () => LOG_FILE,
  getLogContent: () => {
    if (IS_SERVERLESS) return 'Log file unavailable in this environment. Check Vercel function logs instead.';
    try {
      return fs.readFileSync(LOG_FILE, 'utf-8');
    } catch {
      return 'No logs available yet';
    }
  }
};
