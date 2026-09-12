import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateOrderDto } from './dto/create-order.dto';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Client } from '../clients/entities/client.entity';
import { Product } from '../products/entities/products.entities';

@Injectable()
export class OrdersService {
  constructor(private readonly dataSource: DataSource) {}

  create(data: CreateOrderDto): Promise<Order> {
    // 1. Require exactly one client option.
    if (data.clientId === null || data.newClient === null) {
      throw new BadRequestException(
        'clientId and newClient cannot be null',
      );
    }

    const hasClientId = data.clientId !== undefined;
    const hasNewClient = data.newClient !== undefined;

    if (hasClientId === hasNewClient) {
      throw new BadRequestException(
        'Provide exactly one of clientId or newClient',
      );
    }

    // 2. Require items and reject repeated products.
    if (!Array.isArray(data.items) || data.items.length === 0) {
      throw new BadRequestException(
        'An order must contain at least one item',
      );
    }

    const seenProductIds = new Set<number>();

    for (const item of data.items) {
      if (
        !item ||
        !Number.isInteger(item.productId) ||
        item.productId < 1 ||
        !Number.isInteger(item.orderedQuantity) ||
        item.orderedQuantity < 1
      ) {
        throw new BadRequestException(
          'Each item needs a positive integer productId and orderedQuantity',
        );
      }

      if (seenProductIds.has(item.productId)) {
        throw new BadRequestException(
          `Duplicate productId ${item.productId} in order items`,
        );
      }

      seenProductIds.add(item.productId);
    }

    return this.dataSource.transaction(async (manager) => {
      // All database writes use this transaction's repositories.
      const clientRepository = manager.getRepository(Client);
      const productRepository = manager.getRepository(Product);
      const orderRepository = manager.getRepository(Order);
      const orderItemRepository = manager.getRepository(OrderItem);

      // 3. Find the existing client or save the new client.
      let client: Client;

      if (data.clientId !== undefined) {
        const existingClient = await clientRepository.findOneBy({
          id: data.clientId,
        });

        if (!existingClient) {
          throw new NotFoundException('Client was not found');
        }

        client = existingClient;
      } else {
        const newClient = clientRepository.create({
          name: data.newClient!.name,
        });

        client = await clientRepository.save(newClient);
      }

      // 4. Lock products in a consistent order and check stock.
      const sortedItems = [...data.items].sort(
        (a, b) => a.productId - b.productId,
      );

      const checkedItems: {
        product: Product;
        orderedQuantity: number;
      }[] = [];

      for (const item of sortedItems) {
        const product = await productRepository.findOne({
          where: { id: item.productId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!product) {
          throw new NotFoundException(
            `Product ${item.productId} was not found`,
          );
        }

        if (product.availableStock < item.orderedQuantity) {
          throw new BadRequestException(
            `Insufficient stock for product ${item.productId}`,
          );
        }

        checkedItems.push({
          product: product,
          orderedQuantity: item.orderedQuantity,
        });
      }

      // 5. Create ONE order after all products pass the checks.
      const order = orderRepository.create({
        client: client,
      });

      const savedOrder = await orderRepository.save(order);

      // 6. Save purchase details and decrease stock.
      for (const item of checkedItems) {
        const orderItem = orderItemRepository.create({
          order: savedOrder,
          product: item.product,
          orderedQuantity: item.orderedQuantity,
          unitPriceAtPurchase: item.product.price,
        });

        await orderItemRepository.save(orderItem);

        item.product.availableStock -= item.orderedQuantity;
        await productRepository.save(item.product);
      }

      // Successful completion allows the transaction to commit.
      return savedOrder;
    });
  }
}