
## Manual concurrent-request test

- we create a product with quantity of 3, 
- we send two parallel POST requests, each requesting 2 units
- we get a one created order successfully, and one failed order due to insufficient stock
- We checked the orders and found only one new order, containing one order item with quantity 2
- We sent the requests using parallel PowerShell jobs, but did not verify whether they overlapped inside Postgres
- We checked the product's remaining stock and confirmed it was 1


