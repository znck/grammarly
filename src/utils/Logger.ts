import { inspect } from 'util';
import { error } from 'console';
import { isString, isError } from '@/utils/is';

export enum LoggerLevel {
  TRACE = 'TRACE',
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  NONE = 'NONE',
}

export class Logger {
  static Level = LoggerLevel;
  static options = {
    enabled: new Set(['*']),
    level: LoggerLevel.TRACE,
  };

  constructor(public readonly name: string, public readonly defaultContext: string = '') {}

  trace(msg: string, ...args: any[]): void;
  trace(context: string, msg: string, ...args: any[]): void;
  trace(...args: any[]) {
    this.write(LoggerLevel.TRACE, args);
  }

  debug(msg: string, ...args: any[]): void;
  debug(context: string, msg: string, ...args: any[]): void;
  debug(...args: any[]) {
    this.write(LoggerLevel.TRACE, args);
  }

  info(msg: string, ...args: any[]): void;
  info(context: string, msg: string, ...args: any[]): void;
  info(...args: any[]) {
    this.write(LoggerLevel.TRACE, args);
  }

  warn(msg: string, ...args: any[]): void;
  warn(context: string, msg: string, ...args: any[]): void;
  warn(...args: any[]) {
    this.write(LoggerLevel.TRACE, args);
  }

  error(msg: string, ...args: any[]): void;
  error(msg: Error, ...args: any[]): void;
  error(context: string, msg: string, ...args: any[]): void;
  error(context: string, msg: Error, ...args: any[]): void;
  error(...args: any[]) {
    this.write(LoggerLevel.TRACE, args);
  }

  private write(level: LoggerLevel, args: any[]) {
    if (level >= Logger.options.level && (Logger.options.enabled.has('*') || Logger.options.enabled.has(this.name))) {
      const context =
        args.length >= 2 && isString(args[0]) && (isString(args[1]) || isError(args[1]))
          ? args.shift()
          : this.defaultContext;

      const message = `${Date.now()} ${level}  [${this.name}]${context ? ' (' + context + ')' : ''} ${this.inspect(
        args
      )}`;

      switch (level) {
        case LoggerLevel.ERROR:
          console.error(message);
          break;
        case LoggerLevel.WARN:
          console.warn(message);
          break;
        default:
          console.log(message);
          break;
      }
    }
  }

  private inspect(args: any[]) {
    return args.map((arg) => (typeof arg === 'object' && arg ? inspect(arg, true, null) : arg)).join(' ');
  }
}
