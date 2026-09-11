# Faraz Pharmacy - Backend API

RESTful API server for pharmacy management system built with Express.js, TypeScript, and Prisma ORM.

## Tech Stack

- **Runtime**: Node.js >= 18
- **Framework**: Express.js
- **Language**: TypeScript (ES2023)
- **ORM**: Prisma 7.x
- **Database**: PostgreSQL
- **Auth**: JWT (Access + Refresh tokens)
- **Real-time**: Socket.io
- **Validation**: Zod
- **Build Tool**: tsup

## Project Structure

```
server/
├── prisma/
│   ├── schema.prisma        # Database schema
│   └── seed.ts              # Seed script
├── src/
│   ├── config/              # Environment config
│   ├── generated/           # Prisma generated client
│   ├── middleware/           # Auth, validation, error handling
│   ├── modules/             # Feature modules (controller, service, routes, schema)
│   │   ├── arrears/
│   │   ├── auth/
│   │   ├── barcodes/
│   │   ├── categories/
│   │   ├── companies/
│   │   ├── customers/
│   │   ├── expenses/
│   │   ├── inventory/
│   │   ├── medicines/
│   │   ├── purchases/
│   │   ├── reports/
│   │   ├── returns/
│   │   ├── sales/
│   │   ├── settings/
│   │   ├── suppliers/
│   │   └── users/
│   ├── services/            # Prisma client instance
│   ├── socket/              # Socket.io setup
│   ├── types/               # TypeScript declarations
│   ├── utils/               # Logger, errors, helpers
│   ├── app.ts               # Express app setup
│   └── server.ts            # Entry point
├── .env                     # Environment variables (not committed)
├── .env.example             # Env template
├── tsconfig.json
└── package.json
```

## Setup

### Prerequisites

- Node.js >= 18
- PostgreSQL running on port 5432

### Installation

```bash
npm install
```

### Environment Variables

Copy `.env.example` to `.env` and update:

```bash
cp .env.example .env
```

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/faraz-pharmacy"
JWT_SECRET="your-secret-key"
PORT=3001
```

### Database Setup

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database (no migrations)
npm run db:push

# Reset database and push schema
npm run db:push:reset

# Run migrations
npm run db:migrate

# Create named migration
npm run db:migrate:name -- --name migration_name

# Deploy migrations (production)
npm run db:deploy

# Seed database
npm run db:seed
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with tsx |
| `npm run build` | Build for production |
| `npm run start` | Run production build |
| `npm run lint` | Type check with tsc |
| `npm run setup` | Install + setup DB + build |

## API Endpoints

All routes prefixed with `/api`. Auth required on marked routes.

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/refresh` | Refresh token |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/verify-password` | Verify password |
| POST | `/api/auth/generate-recovery-key` | Generate recovery key |
| POST | `/api/auth/recover-password` | Recover password |

### Products (Medicines)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/products/` | List all |
| GET | `/api/products/search` | Search products |
| GET | `/api/products/barcode/:b` | Get by barcode |
| POST | `/api/products/` | Create product |
| PUT | `/api/products/:id` | Update product |
| DELETE | `/api/products/:id` | Delete product |
| POST | `/api/products/:id/restore` | Restore deleted |

### Sales
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sales/` | List all |
| GET | `/api/sales/recent` | Recent sales |
| GET | `/api/sales/search` | Search sales |
| GET | `/api/sales/date/:date` | Sales by date |
| GET | `/api/sales/:id` | Get sale by ID |
| POST | `/api/sales/` | Create sale |

### Customers
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/customers/` | List all |
| GET | `/api/customers/search` | Search customers |
| GET | `/api/customers/:id` | Get customer |
| POST | `/api/customers/` | Create customer |
| PUT | `/api/customers/:id` | Update customer |
| DELETE | `/api/customers/:id` | Delete customer |

### Distributors (Suppliers)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/distributors/` | List all |
| POST | `/api/distributors/` | Create distributor |
| PUT | `/api/distributors/:id` | Update distributor |
| DELETE | `/api/distributors/:id` | Delete distributor |

### Companies
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/companies/` | List all |
| POST | `/api/companies/` | Create company |
| PUT | `/api/companies/:id` | Update company |
| DELETE | `/api/companies/:id` | Delete company |

### Stock Purchases
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stock/` | List all |
| POST | `/api/stock/` | Create purchase |
| PUT | `/api/stock/:id` | Update purchase |
| DELETE | `/api/stock/:id` | Delete purchase |

### Returns 🔒
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/returns/` | List all |
| GET | `/api/returns/:id` | Get return |
| POST | `/api/returns/` | Create return |

### Arrears 🔒
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/arrears/` | List all |
| POST | `/api/arrears/` | Create arrear |
| POST | `/api/arrears/:id/pay` | Pay arrear |
| POST | `/api/arrears/:id/settle` | Settle arrear |
| DELETE | `/api/arrears/:id` | Delete arrear |

### Barcodes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/barcodes/` | List all |
| POST | `/api/barcodes/` | Create barcode |
| DELETE | `/api/barcodes/:id` | Delete barcode |

### Categories
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/categories/` | List all |
| POST | `/api/categories/` | Create category |
| PUT | `/api/categories/:id` | Update category |
| DELETE | `/api/categories/:id` | Delete category |

### Expenses
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/expenses/` | List all |
| POST | `/api/expenses/` | Create expense |
| PUT | `/api/expenses/:id` | Update expense |
| DELETE | `/api/expenses/:id` | Delete expense |

### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/stats` | Get stats |

### Settings
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/settings/backup` | Create backup |
| GET | `/api/settings/backups` | List backups |
| DELETE | `/api/settings/backup` | Delete backup |
| POST | `/api/settings/backup/restore` | Restore backup |
| GET | `/api/settings/backup/directory` | Get backup dir |
| GET | `/api/settings/gdrive` | Get GDrive config |
| PUT | `/api/settings/gdrive` | Update GDrive config |

## Database Models

- **User** - Admin users with roles
- **AuthToken** - JWT access/refresh tokens
- **RecoveryKey** - Account recovery keys
- **Product** - Medicine/product catalog
- **Barcode** - Product barcodes
- **ProductPrice** - Multiple price tiers
- **Distributor** - Product suppliers
- **Company** - Distributor companies
- **Customer** - Pharmacy customers
- **Sale** - Sales transactions
- **SaleItem** - Items in a sale
- **Arrear** - Customer debt/credit
- **ArrearPayment** - Arrear payments
- **StockPurchase** - Inventory purchases
- **ReturnEntry** - Return transactions
- **ReturnItem** - Items returned
- **Category** - Product categories
- **Expense** - Business expenses
