# MD24 HR Management System

An HR management system demonstrating a **salary exposure** bug where managers can see all employee salaries without role-based filtering.

## Features

- Employee profiles with org chart
- Leave management (requests, approvals, balances)
- Performance reviews with 360 feedback
- Payroll integration stub
- Recruitment pipeline (applicant tracking)

## The Bug

**Manager Can See All Salaries**: The `GET /api/employees` endpoint returns all employee data including `salary` field without filtering based on the requesting user's role. A manager (or even a regular employee) can see everyone's salary.

## Architecture

```
src/
├── server.ts          # Express app entry point
├── routes/            # API route definitions
├── controllers/       # Request handlers
├── services/          # Business logic
├── middleware/        # Auth, validation, error handling, RBAC
├── types/             # TypeScript interfaces
└── utils/             # Helpers
```

## Getting Started

```bash
# Install dependencies
npm install

# Start PostgreSQL
docker-compose up -d

# Setup database
npx prisma migrate dev
npx prisma db seed

# Run development server
npm run dev

# Run tests
npm test
```

## Environment Variables

```
DATABASE_URL="postgresql://hr:hr123@localhost:54324/hr_management"
PORT=3000
JWT_SECRET="your-secret-key"
```

## API Endpoints

- `GET /api/employees` - List all employees (BUG: exposes all salaries)
- `GET /api/employees/:id` - Get employee details
- `POST /api/leave` - Submit leave request
- `POST /api/leave/:id/approve` - Approve leave
- `GET /api/reviews` - List performance reviews
- `POST /api/reviews` - Create performance review
- `GET /api/recruitment/applicants` - List applicants
- `POST /api/recruitment/applicants` - Add applicant
