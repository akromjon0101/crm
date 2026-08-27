# EduCRM — Educational Center Management System

A full-stack CRM system for managing students, teachers, groups, payments, and attendance in a learning center.

## Tech Stack

| Layer     | Technology                   |
|-----------|------------------------------|
| Frontend  | React 18 + Tailwind CSS 3    |
| Backend   | Node.js + Express            |
| Database  | PostgreSQL                   |
| Auth      | JWT (JSON Web Tokens)        |
| Charts    | Recharts                     |

---

## Project Structure

```
crm/
├── backend/
│   ├── src/
│   │   ├── config/          # Database config
│   │   ├── controllers/     # Route controllers
│   │   ├── middleware/       # Auth & role middleware
│   │   └── routes/          # API routes
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/      # Reusable components
│   │   ├── context/         # Auth context
│   │   ├── pages/           # Page components
│   │   ├── services/        # Axios API service
│   │   └── utils/           # Helper functions
│   └── package.json
└── database/
    └── schema.sql           # DB schema + seed data
```

---

## Quick Start

### 1. Database Setup

```bash
# Create database
createdb crm_db

# Run schema
psql -U postgres -d crm_db -f database/schema.sql
```

### 2. Backend Setup

```bash
cd backend
npm install

# Copy and configure environment
cp .env.example .env
# Edit .env with your database credentials

npm run dev
# Server starts at http://localhost:5000
```

### 3. Frontend Setup

```bash
cd frontend
npm install
npm start
# App starts at http://localhost:3000
```

---

## Default Login

| Role       | Email                    | Password  |
|------------|--------------------------|-----------|
| Super Admin| superadmin@crm.uz        | password  |

> **Note:** The seed data password hash uses `password`. Change it in production!

To generate a new hash:
```js
const bcrypt = require('bcryptjs');
console.log(bcrypt.hashSync('your_password', 10));
```

---

## API Routes

### Auth
| Method | Endpoint                | Access  |
|--------|------------------------|---------|
| POST   | /api/auth/login         | Public  |
| GET    | /api/auth/me            | All     |
| PUT    | /api/auth/change-password| All    |

### Users
| Method | Endpoint                | Access         |
|--------|------------------------|----------------|
| GET    | /api/users              | Admin+         |
| GET    | /api/users/teachers     | All            |
| POST   | /api/users              | Admin+         |
| PUT    | /api/users/:id          | Admin+         |
| DELETE | /api/users/:id          | Super Admin    |

### Students
| Method | Endpoint                     | Access      |
|--------|------------------------------|-------------|
| GET    | /api/students                | All         |
| GET    | /api/students/:id            | All         |
| POST   | /api/students                | Admin+      |
| PUT    | /api/students/:id            | Admin+      |
| DELETE | /api/students/:id            | Admin+      |
| PUT    | /api/students/:id/transfer   | Admin+      |
| PUT    | /api/students/:id/toggle-debtor| Admin+    |
| POST   | /api/students/:id/notes      | All         |

### Groups
| Method | Endpoint           | Access  |
|--------|--------------------|---------|
| GET    | /api/groups        | All     |
| GET    | /api/groups/:id    | All     |
| POST   | /api/groups        | Admin+  |
| PUT    | /api/groups/:id    | Admin+  |
| DELETE | /api/groups/:id    | Admin+  |

### Payments
| Method | Endpoint                  | Access  |
|--------|--------------------------|---------|
| GET    | /api/payments             | Admin+  |
| POST   | /api/payments             | Admin+  |
| DELETE | /api/payments/:id         | Admin+  |
| GET    | /api/payments/stats/monthly| Admin+ |
| GET    | /api/payments/debtors     | Admin+  |

### Attendance
| Method | Endpoint                         | Access |
|--------|----------------------------------|--------|
| GET    | /api/attendance                  | All    |
| POST   | /api/attendance                  | All    |
| GET    | /api/attendance/group/:groupId   | All    |

### Analytics
| Method | Endpoint                          | Access  |
|--------|----------------------------------|---------|
| GET    | /api/analytics/dashboard         | All     |
| GET    | /api/analytics/income-chart      | Admin+  |
| GET    | /api/analytics/student-growth    | Admin+  |
| GET    | /api/analytics/teacher-performance| Admin+ |

---

## Role Permissions

| Feature              | Super Admin | Admin | Teacher |
|----------------------|:-----------:|:-----:|:-------:|
| Dashboard stats      | ✅          | ✅    | Limited |
| Analytics charts     | ✅          | ✅    | ❌      |
| Manage students      | ✅          | ✅    | View    |
| Manage groups        | ✅          | ✅    | View    |
| Manage teachers      | ✅          | ✅    | ❌      |
| View payments        | ✅          | ✅    | ❌      |
| Mark attendance      | ✅          | ✅    | ✅      |
| Add student notes    | ✅          | ✅    | ✅      |
| Delete users         | ✅          | ❌    | ❌      |

---

## Environment Variables

```env
PORT=5000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_NAME=crm_db
DB_USER=postgres
DB_PASSWORD=your_password

JWT_SECRET=your_super_secret_key
JWT_EXPIRES_IN=7d

CLIENT_URL=http://localhost:3000
```
