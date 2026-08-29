import { join } from 'node:path';
import { utilities as nestWinstonModuleUtilities, WinstonModuleOptions } from 'nest-winston';
import * as winston from 'winston';
import 'winston-daily-rotate-file';

export const ACCESS_LOGGER = 'ACCESS_LOGGER';
export const ERROR_LOGGER = 'ERROR_LOGGER';
export const SECURITY_LOGGER = 'SECURITY_LOGGER';

const logDirectory = join(process.cwd(), 'logs');

const onlyChannel = (channel: string) =>
  winston.format((info) => (info.channel === channel ? info : false))();

const rotatedJsonTransport = (channel: string, level: string, filename: string) =>
  new winston.transports.DailyRotateFile({
    filename: join(logDirectory, filename),
    level,
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    format: winston.format.combine(
      onlyChannel(channel),
      winston.format.timestamp(),
      winston.format.json(),
    ),
  });

export const winstonConfig: WinstonModuleOptions = {
  level: process.env.LOG_LEVEL || 'info',
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.ms(),
        nestWinstonModuleUtilities.format.nestLike('DineTime', {
          colors: true,
          prettyPrint: true,
        }),
      ),
    }),
    rotatedJsonTransport('access', 'info', 'access-%DATE%.log'),
    rotatedJsonTransport('error', 'error', 'error-%DATE%.log'),
    rotatedJsonTransport('security', 'warn', 'security-%DATE%.log'),
  ],
};
