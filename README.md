# Access Control — Roles & Permissions (RBAC)

An ERP-style **Access Control module** for managing roles, module permissions, branch access and approval levels, with a full audit trail.

- **Frontend:** React 18, Vite 6, React Router 7, Tailwind CSS 3, Lucide icons
- **Backend:** Node.js (22+), Express 4, MongoDB with Mongoose 8, JWT authentication, bcrypt password hashing, Zod validation
- **Tests:** Node's built-in test runner + Supertest against a throw-away in-memory MongoDB (47 tests)

```
AccessControl-RBAC/
├── backend/                 Express API
│   ├── src/
│   │   ├── config/          env, database connection, permission catalog
│   │   ├── models/          User, Role, Permission, Branch, AuditLog
│   │   ├── middleware/      auth (JWT + permission checks), validation, error handler
│   │   ├── validators/      request schemas (Zod)
│   │   ├── services/        business rules (roles, users, branches, reports, audit)
│   │   ├── controllers/     HTTP handlers
│   │   ├── routes/          route definitions
│   │   ├── seed/            idempotent sample data
│   │   └── scripts/         `npm run seed`, `npm run setup:admin`
│   └── tests/               API & business-rule tests
└── frontend/                React app
    └── src/
        ├── components/      layout, UI kit, permission matrix, role form, dialogs
        ├── context/         auth + toast notifications
        ├── lib/             API client, formatting helpers
        └── pages/           Dashboard, Roles, Role details/form, Permission Matrix,
                             Approval Levels, User Assignments, Audit Logs, Reports …
```

---

## 1. Run it locally

### Prerequisites
- **Node.js 22 or newer** (`node -v`)
- **MongoDB** running locally (the Windows "MongoDB" service), or a MongoDB Atlas connection string

### Step 1 — Backend
```bash
cd backend
npm install
cp .env.example .env          # Windows PowerShell: Copy-Item .env.example .env
```
Open `backend/.env` and fill in at least:

| Variable | What to put |
|---|---|
| `JWT_SECRET` | A long random string. Generate one: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | The first administrator account (password: 12+ chars, upper + lower case + a number) |
| `DEMO_USER_PASSWORD` | *(optional)* lets demo staff users sign in, so you can test non-admin access |

Then create the sample data and the first administrator, and start the API:
```bash
npm run seed           # permissions, 5 branches, 6 roles, 7 demo staff users
npm run setup:admin    # creates the System Administrator from ADMIN_* variables
npm run dev            # API on http://localhost:5050/api  (auto-restarts on changes)
```
Both scripts are **safe to run again** — they never create duplicates and never reset an existing password.

### Step 2 — Frontend (in a second terminal)
```bash
cd frontend
npm install
cp .env.example .env          # VITE_API_BASE_URL=http://localhost:5050/api
npm run dev                   # http://localhost:5180
```
Open **http://localhost:5180** and sign in with your `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

> **Ports:** this project uses **5050** (API) and **5180** (frontend) so it doesn't clash with other projects on the common 5000/5173 ports. To change them, edit `PORT` + `CORS_ORIGIN` in `backend/.env`, `VITE_API_BASE_URL` in `frontend/.env`, and `frontend/vite.config.js`.

### Demo accounts
| Account | Role | Branch scope | Sign-in |
|---|---|---|---|
| your `ADMIN_EMAIL` | System Administrator | All branches | `ADMIN_PASSWORD` |
| `anita.menon@demo.local` | Branch Manager | Assigned (TVM) | `DEMO_USER_PASSWORD` |
| `fathima.rasheed@demo.local` | Accountant | Selected (HQ, TVM) | `DEMO_USER_PASSWORD` |
| `joseph.thomas@demo.local` | Customer Service Officer | Assigned (TVM) | `DEMO_USER_PASSWORD` |
| `meera.pillai@demo.local` | Regional Auditor | All branches | `DEMO_USER_PASSWORD` |

(Also: `rahul.nair@…`, `divya.suresh@…`, `arun.kumar@…`.) If `DEMO_USER_PASSWORD` was empty when you seeded, demo users get a random password and cannot sign in. Use them only for reports, or create your own users on **Settings → Access Control → User Assignments**.

### Run the tests
```bash
cd backend && npm test        # 47 tests, uses an in-memory MongoDB (downloads a MongoDB binary on first run)
cd frontend && npm run build  # production build check
```

---

## 2. Features

| Area | What you can do |
|---|---|
| **Dashboard** | Role statistics, roles by branch scope, most-assigned roles, recent audit activity, quick links |
| **Roles** | List with search, status/branch-scope filters, sorting (name, created date, user count), pagination; view, create, edit, clone, activate/deactivate (with confirmation), delete unused roles |
| **Role details** | Status, branch scope + selected branches, approval level/limit, permissions grouped by module, user count, created/updated info, change history |
| **Permission Matrix** | Modules × actions grid with select-all / clear-all per row, column and whole matrix; shows unsaved changes and asks for confirmation before saving |
| **Approval Levels** | Roles grouped by approval level with limits, users and Approve permissions; warns about inconsistent settings |
| **User Assignments** | Create staff accounts, change a user's role (active roles only), activate/deactivate users |
| **Audit Logs** | Every role/assignment change with actor, time and before → after details; filter by action |
| **Reports** | Role Summary, Permission Matrix, Role Assignment, Inactive Roles — live data, CSV export |
| **ERP modules** | Customers, Membership, Savings, RD, Loan, Chitty appear as navigation items and permission categories. Each page shows the signed-in user's effective access (the modules themselves are out of scope) |

---

## 3. Business rules (all enforced on the backend)

- Role names are **required, unique (case-insensitive, extra spaces ignored), max 100 chars**. A unique database index on `normalizedName` backs this up.
- A role must have **at least one permission**. Permission keys are validated against the `permissions` collection, so clients cannot invent permissions.
- **Selected Branches** scope requires at least one existing, active branch. Other scopes store no branch IDs.
- Approval level is a whole number **0–10**. An approval limit (≥ 0) is only allowed at level 1 or higher.
- **Inactive roles cannot be assigned** to users (`409 ROLE_INACTIVE`).
- **Roles assigned to users cannot be deleted** (`409 ROLE_IN_USE`).
- The **System Administrator** role cannot be deleted, deactivated or renamed, and its permissions/branch scope are locked (it always has every permission).
- **At least one active System Administrator always exists:** admins cannot change their own role or status, the system role cannot be deactivated, and a service-level guard refuses to demote or deactivate the last active admin.
- **Only System Administrators** can manage roles, users, permissions, approval levels and audit logs.
- **No privilege escalation:** request bodies are strict (unknown fields like `isSystem` are rejected), users can't edit their own role, and every request reloads the user and role from the database. Role or status changes therefore take effect immediately, even for existing sessions.
- **Branch scope is enforced in queries:** the branch list and the Role Assignment report only return data from branches the user may access.
- Deactivating a role immediately blocks its users (`403`) until it's reactivated.

---

## 4. API reference

Base URL: `http://localhost:5050/api`. Send `Authorization: Bearer <token>` on every request except login.

Responses look like `{ "success": true, "data": …, "meta"?: …, "message"?: … }` or
`{ "success": false, "error": { "code": "…", "message": "…", "details"?: [{ "field", "message" }] } }`.

| Method & path | Access | Description |
|---|---|---|
| `POST /auth/login` | public (rate-limited 10/15 min) | `{ email, password }` → `{ token, user }` |
| `GET /auth/me` | signed in | Current user, role, effective permissions, accessible branch IDs |
| `GET /dashboard/stats` | `dashboard.view` | Dashboard statistics (recent activity only for admins) |
| `GET /branches` | signed in | Branches **within the caller's branch scope** |
| `GET /roles` | admin | Query: `search`, `status`, `branchScope`, `sortBy` (`name`/`createdAt`/`userCount`), `sortOrder`, `page`, `limit` |
| `GET /roles/:id` | admin | Role details with grouped permissions and user count |
| `POST /roles` | admin | Create: `{ name, description?, status?, branchScope, branchIds?, approvalLevel?, approvalLimit?, permissions[] }` |
| `PUT /roles/:id` | admin | Update (same body without `status`) |
| `PATCH /roles/:id/status` | admin | `{ status: "active" \| "inactive" }` |
| `POST /roles/:id/clone` | admin | `{ name, …optional overrides }` → new role |
| `PUT /roles/:id/permissions` | admin | `{ permissions: [...] }` |
| `DELETE /roles/:id` | admin | Only roles with no users; never the system role |
| `GET /permissions` | admin | Permission catalog (modules, actions, keys) |
| `GET /approval-levels` | admin | Roles grouped by approval level |
| `GET /audit-logs` | admin | Query: `roleId`, `action`, `page`, `limit` |
| `GET /users` | admin | Query: `search`, `roleId`, `branchId` |
| `POST /users` | admin | `{ name, email, password, roleId, branchId? }` |
| `PATCH /users/:id/role` | admin | `{ roleId }` (not yourself; active roles only) |
| `PATCH /users/:id/status` | admin | `{ status }` (not yourself) |
| `GET /reports/:report` | `reports.view` | `role-summary`, `permission-matrix`, `role-assignment`, `inactive-roles`; add `?format=csv` (needs `reports.export`) |
| `GET /health` | public | Health check |

Common status codes: `400` validation, `401` not signed in / bad token, `403` not allowed, `404` not found, `409` business-rule conflict, `429` too many login attempts.

**Permission keys** are `<module>.<action>`, e.g. `loan.approve`. They're defined once in `backend/src/config/permissions.js` and synced into MongoDB on every start.

---

## 5. Environment variables

**backend/.env**
| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | no | `development` (default) or `production` |
| `PORT` | no | API port (default `5050`) |
| `MONGODB_URI` | yes | MongoDB connection string |
| `MONGODB_DB_NAME` | yes | Database dedicated to this app (default `rbac_access_control`). Names containing "bookmyhall" are refused as a safety guard |
| `JWT_SECRET` | **yes** | ≥ 32 random characters; the server won't start without it |
| `JWT_EXPIRES_IN` | no | Token lifetime (default `8h`) |
| `CORS_ORIGIN` | yes | Frontend URL(s), comma separated, e.g. `https://your-app.vercel.app` |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | for `setup:admin` | First administrator; remove `ADMIN_PASSWORD` after setup |
| `SEED_DEMO_USERS` | no | `false` to skip demo staff users |
| `DEMO_USER_PASSWORD` | no | Lets demo staff users sign in |

**frontend/.env**
| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Backend URL including `/api`. This value is bundled into the public JS, so never put secrets in it |

`.env` files are git-ignored. Only the `.env.example` files are meant to be committed.

---

## 6. Deployment (separate frontend and backend)

### Database — MongoDB Atlas
1. Create a free cluster and a database user. Under *Network Access*, allow your backend host's IPs (or `0.0.0.0/0` for a quick demo).
2. Copy the `mongodb+srv://…` connection string. Use a new database name such as `rbac_access_control`.

### Backend — e.g. Render / Railway
1. New *Web Service* from your repo, **root directory `backend`**.
2. Build command `npm install`, start command `npm start`, Node 22+.
3. Set environment variables: `NODE_ENV=production`, `MONGODB_URI`, `MONGODB_DB_NAME`, `JWT_SECRET` (new random value), `CORS_ORIGIN=https://<your-frontend-domain>`. The host normally provides `PORT`.
4. Once, from the host's shell (or locally, pointed at the production URI): `npm run seed` (consider `SEED_DEMO_USERS=false`), then `npm run setup:admin` with `ADMIN_*` set. Then remove `ADMIN_PASSWORD`.

### Frontend — e.g. Vercel / Netlify
1. New project, **root directory `frontend`**, build command `npm run build`, output directory `dist`.
2. Set `VITE_API_BASE_URL=https://<your-backend-domain>/api` **before building**. Vite bakes it in at build time.
3. Client-side routing rewrites are included: `vercel.json` (Vercel) and `public/_redirects` (Netlify).

---

## 7. Security notes & known limitations

Implemented and covered by tests: bcrypt hashing (12 rounds), JWT (HS256, issuer-checked, 8h expiry), per-request user/role reload, strict input validation, admin-only role management, privilege-escalation guards, generic login errors with timing protection, login rate limiting, Helmet security headers, CORS allow-list, 100 KB body limit, central error handler (no stack traces in responses), CSV formula-injection protection, and no passwords/tokens in audit logs.

This is a **demonstration identity system**, not a full production IAM. Not included:
- Password reset, password change and multi-factor authentication.
- Token revocation / refresh tokens. A signed-out token stays valid until it expires, although role or status changes still apply immediately because each request reloads the user.
- The JWT is stored in `localStorage` for simplicity. An `httpOnly` cookie would be more resistant to XSS.
- The business modules (Customers, Loan, …) are placeholders. Branch scope is enforced on the data that exists here (branches, user/role-assignment reports).
- Writes aren't wrapped in MongoDB transactions. Very rare concurrent admin edits could race; the unique index still prevents duplicate role names.
- Role listing sorts and paginates in memory, which is fine for the hundreds of roles an ERP typically has.
