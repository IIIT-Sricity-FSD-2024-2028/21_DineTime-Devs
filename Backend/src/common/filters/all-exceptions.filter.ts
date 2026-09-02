import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Request, Response } from 'express';
import { Logger } from 'winston';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = this.getStatus(exception);
    const message = this.getMessage(exception, status);
    const requestId = request.header('x-request-id');
    const path = request.originalUrl || request.url;

    this.logger.error('Request failed', {
      channel: 'error',
      statusCode: status,
      method: request.method,
      path,
      message,
      requestId,
      stack: exception instanceof Error ? exception.stack : undefined,
    });

    if ([HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN, HttpStatus.TOO_MANY_REQUESTS].includes(status)) {
      this.logger.warn('Security relevant response', {
        channel: 'security',
        statusCode: status,
        method: request.method,
        path,
        message,
        requestId,
        ip: request.ip,
      });
    }

    response.status(status).json({
      statusCode: status,
      path,
      timestamp: new Date().toISOString(),
      message,
    });
  }

  private getStatus(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }

    if (this.isMulterFileSizeError(exception)) {
      return HttpStatus.PAYLOAD_TOO_LARGE;
    }

    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private getMessage(exception: unknown, status: number): string | string[] {
    if (this.isMulterFileSizeError(exception)) {
      return 'Uploaded file is too large. Maximum size is 5MB.';
    }

    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      if (typeof body === 'string') {
        return body;
      }

      if (body && typeof body === 'object' && 'message' in body) {
        return (body as { message: string | string[] }).message;
      }

      return exception.message;
    }

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      return 'Internal server error';
    }

    return 'Request failed';
  }

  private isMulterFileSizeError(exception: unknown): boolean {
    return Boolean(
      exception
      && typeof exception === 'object'
      && 'code' in exception
      && (exception as { code?: string }).code === 'LIMIT_FILE_SIZE',
    );
  }
}
