import * as fs from 'fs';
import * as path from 'path';

const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, `qna-${new Date().toISOString().split('T')[0]}.log`);

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

export const logger = {
  info: (message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] INFO: ${message}${data ? ' ' + JSON.stringify(data) : ''}\n`;
    console.log(logEntry);
    fs.appendFileSync(LOG_FILE, logEntry);
  },

  error: (message: string, error?: any) => {
    const timestamp = new Date().toISOString();
    const errorStr = error ? (error instanceof Error ? error.message : JSON.stringify(error)) : '';
    const logEntry = `[${timestamp}] ERROR: ${message}${errorStr ? ' - ' + errorStr : ''}\n`;
    console.error(logEntry);
    fs.appendFileSync(LOG_FILE, logEntry);
  },

  debug: (message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] DEBUG: ${message}${data ? ' ' + JSON.stringify(data) : ''}\n`;
    console.log(logEntry);
    fs.appendFileSync(LOG_FILE, logEntry);
  },

  warn: (message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] WARN: ${message}${data ? ' ' + JSON.stringify(data) : ''}\n`;
    console.warn(logEntry);
    fs.appendFileSync(LOG_FILE, logEntry);
  },

  getLogFile: () => LOG_FILE,
  getLogContent: () => {
    try {
      return fs.readFileSync(LOG_FILE, 'utf-8');
    } catch {
      return 'No logs available yet';
    }
  }
};
