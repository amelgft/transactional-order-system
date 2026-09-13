# Clients API

## Client Model

| Property            | API type | Description|
|---|---|---|
| `id`                | number   | Generated automatically by PostgreSQL |
| `name`              | string   | client name |

## Endpoints

| Method | Path           | Purpose                  | Success  | Errors |
|---|---|---|---|---|
| GET    | `/clients`    | List all clients          | `200`    | —            |
| GET    | `/clients/:id`| Retrieve one client       | `200`    | `400`, `404` |
| PATCH  | `/clients/:id`| update a client name      | `200`    | `400`, `404` |
| DELETE | `/clients/:id`| Delete a client           | `204`    | `400`, `404` |

New clients are created through `POST /orders` using `newClient`, and saved only if the entire order succeeds.

## Create Client Validation

`id`:
- Generated automatically
- Not included in CreateClientDto

`name`:
- Required
- Non-empty string


## Update Client Validation

name field is optional, but the provided field must satisfy its original validation rules 
Only the `name` field may be updated
empy body is currentely accepted but change nothing 

## Database Rules

PostgreSQL table is `clients`
TypeScript id maps to `client_id`
`client_id` is a generated primary key
name is `varchar NOT NULL`
Names are not unique because different clients may have the same name
DTO rejects "", while PostgreSQL’s NOT NULL specifically rejects null



