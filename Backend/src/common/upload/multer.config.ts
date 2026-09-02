import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import { mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const allowedTicketMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);
const restaurantUploadDirectory = join(process.cwd(), 'uploads', 'restaurants');
const profileUploadDirectory = join(process.cwd(), 'uploads', 'profiles');
const ticketUploadDirectory = join(process.cwd(), 'uploads', 'tickets');
const managerDocumentUploadDirectory = join(process.cwd(), 'uploads', 'managers');

const createDestination = (directory: string) => (
  _req: Express.Request,
  _file: Express.Multer.File,
  cb: (error: Error | null, destination: string) => void,
) => {
  mkdirSync(directory, { recursive: true });
  cb(null, directory);
};

const timestampedFilename = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: (error: Error | null, filename: string) => void,
) => {
  const safeName = file.originalname
    .replace(extname(file.originalname), '')
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .slice(0, 80);
  cb(null, `${Date.now()}-${safeName}${extname(file.originalname).toLowerCase()}`);
};

const imageFileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
) => {
  if (!allowedMimeTypes.has(file.mimetype)) {
    cb(new BadRequestException('Only JPEG, PNG, and WEBP images are allowed'), false);
    return;
  }

  cb(null, true);
};

export const multerConfig = {
  storage: diskStorage({
    destination: createDestination(restaurantUploadDirectory),
    filename: timestampedFilename,
  }),
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
};

export const profilePhotoMulterConfig = {
  storage: diskStorage({
    destination: createDestination(profileUploadDirectory),
    filename: timestampedFilename,
  }),
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
};

const ticketAttachmentFileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
) => {
  if (!allowedTicketMimeTypes.has(file.mimetype)) {
    cb(new BadRequestException('Only JPEG, PNG, WEBP, or PDF files are allowed'), false);
    return;
  }

  cb(null, true);
};

export const ticketAttachmentMulterConfig = {
  storage: diskStorage({
    destination: createDestination(ticketUploadDirectory),
    filename: timestampedFilename,
  }),
  fileFilter: ticketAttachmentFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 5,
  },
};

export const managerDocumentMulterConfig = {
  storage: diskStorage({
    destination: createDestination(managerDocumentUploadDirectory),
    filename: timestampedFilename,
  }),
  fileFilter: ticketAttachmentFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
};
