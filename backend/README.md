# Smart Fox VTU Backend — Milestone 2.1

This folder contains the first backend foundation for Smart Fox VTU.

## Included
- Node.js + Express API
- Environment-variable configuration
- MySQL connection pool
- Security middleware (Helmet)
- CORS and JSON parsing
- API logging
- Health endpoint
- Initial MySQL schema for users, admins, wallets, wallet ledger, payments, service transactions, refunds, webhooks and services

## Setup on Windows

### 1. Install dependencies
Open a terminal inside `backend`:

```bash
npm install
```

### 2. Create environment file
Copy `.env.example` to `.env` and enter your local MySQL password.

Never upload `.env` to GitHub.

### 3. Create the database
Open MySQL Workbench, open `database/schema.sql`, and run the whole script.

### 4. Start the API

```bash
npm start
```

For development:

```bash
npm run dev
```

The API should start on:

`http://localhost:5000`

Health check:

`http://localhost:5000/api/health`

## Important
This milestone does **not** connect real payment gateways or VTU providers and does not contain production credentials. Authentication and wallet APIs come next.
