/**
 * Logger Utility
 * Provides standardized logging functionality for the API server
 */

// Define log levels and their priorities
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

// Get configured log level from environment
const getConfiguredLogLevel = (): LogLevel => {
  const level = (process.env.LOG_LEVEL || 'info').toLowerCase();
  
  switch (level) {
    case 'debug': return LogLevel.DEBUG;
    case 'info': return LogLevel.INFO;
    case 'warn': return LogLevel.WARN;
    case 'error': return LogLevel.ERROR;
    default: return LogLevel.INFO;
  }
};

// Determine if a message should be logged based on its level
const shouldLog = (messageLevel: LogLevel): boolean => {
  const configuredLevel = getConfiguredLogLevel();
  return messageLevel >= configuredLevel;
};

// Format the log message
const formatMessage = (level: string, message: string, ...args: any[]): string => {
  // Format any objects passed as additional arguments
  const formattedArgs = args.map(arg => {
    if (typeof arg === 'object' && arg !== null) {
      try {
        return JSON.stringify(arg);
      } catch (e) {
        return '[Object]';
      }
    }
    return arg;
  });
  
  // Generate timestamp
  const timestamp = new Date().toISOString();
  
  // Combine all parts of the message
  return `[${timestamp}] [${level.toUpperCase()}] ${message} ${formattedArgs.join(' ')}`;
};

// Determine if structured logging is enabled
const useStructuredLogs = (): boolean => {
  return process.env.STRUCTURED_LOGGING === 'true';
};

// Create a structured log object
const createStructuredLog = (level: string, message: string, ...args: any[]): object => {
  const timestamp = new Date().toISOString();
  
  const logObject: Record<string, any> = {
    timestamp,
    level: level.toUpperCase(),
    message,
  };
  
  // Add additional args as metadata if they exist
  if (args.length > 0) {
    logObject.metadata = args;
  }
  
  return logObject;
};

// Logger implementation
export const logger = {
  debug: (message: string, ...args: any[]): void => {
    if (!shouldLog(LogLevel.DEBUG)) return;
    
    if (useStructuredLogs()) {
      console.log(JSON.stringify(createStructuredLog('debug', message, ...args)));
    } else {
      console.log(formatMessage('debug', message, ...args));
    }
  },
  
  info: (message: string, ...args: any[]): void => {
    if (!shouldLog(LogLevel.INFO)) return;
    
    if (useStructuredLogs()) {
      console.log(JSON.stringify(createStructuredLog('info', message, ...args)));
    } else {
      console.log(formatMessage('info', message, ...args));
    }
  },
  
  warn: (message: string, ...args: any[]): void => {
    if (!shouldLog(LogLevel.WARN)) return;
    
    if (useStructuredLogs()) {
      console.warn(JSON.stringify(createStructuredLog('warn', message, ...args)));
    } else {
      console.warn(formatMessage('warn', message, ...args));
    }
  },
  
  error: (message: string, ...args: any[]): void => {
    if (!shouldLog(LogLevel.ERROR)) return;
    
    if (useStructuredLogs()) {
      console.error(JSON.stringify(createStructuredLog('error', message, ...args)));
    } else {
      console.error(formatMessage('error', message, ...args));
    }
  },
};

export default logger; 