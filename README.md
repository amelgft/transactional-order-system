# Transactional Order and Inventory System

## Overview

A B2B backend system that helps sellers manage products, client orders,
and inventory. Order creation uses database transactions to save purchase
details and update stock together. Product row locks ensure competing
orders check updated stock, helping prevent overselling.


## Features
- Product management: create, list, retrieve, update, and delete products.
- Client management: list, retrieve, update, and delete clients.
- Orders: create orders, list orders, and retrieve order details with calculated totals.
- Atomic order creation: save the client, order, order items, and stock updates in one transaction. 
If it fails, none of its changes are retained.
- Purchase-price snapshots: preserve each item's unit price at purchase so later product-price
changes do not affect historical order totals.
- Concurrency protection: lock product rows during order creation so competing orders check stock after preceding updates complete, rejecting orders when stock is insufficient.

## Tech Stack

- Language: TypeScript
- Runtime: Node.js
- Backend framework: NestJS
- Database: PostgreSQL
- ORM: TypeORM

## Local Setup

From the repository root:

1. Open the backend folder: `cd backend`
2. Install dependencies: `npm ci`
3. Copy `.env.example` to `.env` and fill in your local database settings.
4. Create a PostgreSQL database named `transactional_order_system`.
5. Check that `.env` matches your PostgreSQL connection settings.
   The example uses port `5433`; change it if your server uses another port.
6. Apply database migrations from the `backend` folder:

   ```bash
   npx typeorm-ts-node-commonjs migration:run -d src/database/data-source.ts
   ```
7. Start the backend:

   ```bash
   npm run start:dev
   ```
8. Access the API at `http://localhost:3000`.



## API Endpoints

Base URL: `http://localhost:3000`

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/products` | Create a product |
| GET | `/products` | List products |
| GET | `/products/:id` | Retrieve a product |
| PATCH | `/products/:id` | Update a product |
| DELETE | `/products/:id` | Delete a product |
| GET | `/clients` | List clients |
| GET | `/clients/:id` | Retrieve a client |
| PATCH | `/clients/:id` | Update a client's name |
| DELETE | `/clients/:id` | Delete a client |
| POST | `/orders` | Create an order |
| GET | `/orders` | List orders with totals |
| GET | `/orders/:id` | Retrieve an order with its client, items, products, and total |

New clients are created through `POST /orders`.
Order creation requires exactly one of `clientId` or `newClient`.

## Project Status

MVP completed.

Implemented:
- Product management
- Client management
- Order creation
- Order retrieval
- Stock management
- Database transactions
- Concurrency protection
- Database migrations

## Docker

Docker Compose runs the NestJS API and PostgreSQL database together.

```bash
docker compose up -d --build
docker compose exec backend npx typeorm-ts-node-commonjs migration:run -d src/database/data-source.ts
docker compose down
```

The API is available at `http://localhost:3000`

