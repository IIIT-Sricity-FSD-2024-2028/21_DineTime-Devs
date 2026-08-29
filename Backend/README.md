# Restaurant Reservation & Capacity Management Backend

NestJS backend with strict modular architecture and in-memory repositories.

## Run

```bash
npm install
npm run build
npm run start
```

Server runs on `http://localhost:3000`.
Swagger docs: `http://localhost:3000/api-docs`

## Middleware & Security

The backend now starts with production-grade middleware:

- `helmet` sets common HTTP security headers.
- CORS allows the existing frontend by default and can be restricted with `CORS_ORIGINS`.
- `RequestIdMiddleware` adds `x-request-id` to every request and response.
- `LoggerMiddleware` writes access logs after each response.
- `RoleCheckMiddleware` audits protected router groups (`/users`, `/reservations`, `/payments`) and rejects missing or malformed auth context.
- `AllExceptionsFilter` returns consistent JSON errors:

```json
{
  "statusCode": 401,
  "path": "/reservations",
  "timestamp": "2026-08-30T00:00:00.000Z",
  "message": "Missing role header"
}
```

Existing frontend requests that send the `role` header still work. New clients can also call `POST /auth/login` and send `Authorization: Bearer <token>`.

## Environment

```bash
PORT=3000
CORS_ORIGINS=http://localhost:5500,http://127.0.0.1:5500
JWT_SECRET=replace-this-in-production
JWT_EXPIRES_IN=1h
LOG_LEVEL=info
```

When `CORS_ORIGINS` is empty, CORS is permissive so the checked-in static frontend can run from local files or any local static server during development.

## Logs & Uploads

Runtime files are stored outside source control:

- Access logs: `logs/access-YYYY-MM-DD.log`
- Error logs: `logs/error-YYYY-MM-DD.log`
- Security/audit logs: `logs/security-YYYY-MM-DD.log`
- Restaurant uploads: `uploads/restaurants/`
- User profile photo uploads: `uploads/profiles/`

Logs rotate at 20 MB per file and are retained for 14 days. Uploaded restaurant images are served from `/uploads/restaurants/<filename>`.
Uploaded profile photos are served from `/uploads/profiles/<filename>` and the URL is stored on the in-memory user record as `photo_url`.

## Auth

Default seeded credentials:

- Diner/manager/staff demo password: `password123`
- Super user: `admin@dinetime.com` / `admin123`

Passwords are stored as bcrypt hashes in the in-memory repository. Because this project still uses in-memory repositories, users, password changes, uploaded image references, reservations, and other data reset when the backend process restarts. Uploaded files themselves remain on disk.

## API Documentation (Swagger)

Swagger is enabled at `GET /api-docs` and generated directly from controllers + DTOs.

- Every endpoint includes `role` header documentation (`diner | manager | staff | super_user`).
- Endpoints with payloads include request body schemas via DTOs.
- Endpoints include response schemas using the standard envelope:
  - list: `{ data: [...] }`
  - item: `{ data: { ... } }`
  - delete: `{ data: { deleted: true } }`

## Smoke Test

```bash
node scripts/smoke-tests.js
```

Use this after `npm run start` to validate core API health quickly.

## Role Header

All protected endpoints require header:

```http
role: diner | manager | staff | super_user
```

JWT bearer tokens from `POST /auth/login` are also accepted by role-protected endpoints.

## Restaurant Image Upload

```bash
curl -X POST http://localhost:3000/restaurants/res-2001/upload-image \
  -H "role: manager" \
  -F "image=@restaurant.jpg"
```

The response is the updated restaurant in the standard `{ data: ... }` envelope with the new `/uploads/restaurants/...` URL appended to `image_urls`.

## Frontend Integration

Use `http://localhost:3000` as API base URL.

### Diner flows
- `GET /restaurants?city={city}`
- `GET /menu?restaurant_id={restaurantId}`
- `GET /tableslots/availability?restaurant_id={restaurantId}&slot_id={slotId}`
- `POST /reservations`
- `POST /payments`
- `POST /orders`
- `GET /notifications?user_id={userId}`
- `GET /settings/users/{userId}`
- `PATCH /settings/users/{userSettingId}`

### Manager flows
- `POST /restaurants`
- `POST /restaurants/locations`
- `POST /tables`
- `POST /timeslots`
- `POST /menu`

### Staff flows
- `GET /reservations`
- `PATCH /reservations/{id}`
- `POST /checkin`
- `PATCH /orders/{id}`

## Notes
- No external database is used.
- Data is stored only in repositories.
- Services do not access in-memory arrays directly.
