import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { CreateOrderDto } from './dto/create-order.dto';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Client } from '../clients/entities/client.entity';
import { Product } from '../products/entities/products.entities';
import { InjectRepository } from '@nestjs/typeorm';
import Big from 'big.js';



@Injectable()
export class OrdersService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Order)

    private readonly orderRepository: Repository<Order>,
  
  ) {}

  private calculateTotal(items: OrderItem[]): string {
  let total = new Big(0);

  for (const item of items) {
    const price = new Big(item.unitPriceAtPurchase)
      .times(item.orderedQuantity);

    total = total.plus(price);
  }

  return total.toFixed(2);
}

  create(data: CreateOrderDto): Promise<Order & { total: string }> {

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

      const order = orderRepository.create({
        client: client,
      });

      const savedOrder = await orderRepository.save(order);
      const savedItems: OrderItem[] = [];

      // 6. Save purchase details and decrease stock.
      for (const item of checkedItems) {
        const orderItem = orderItemRepository.create({
          order: savedOrder,
          product: item.product,
          orderedQuantity: item.orderedQuantity,
          unitPriceAtPurchase: item.product.price,
        });

        const savedItem = await orderItemRepository.save(orderItem);
        savedItems.push(savedItem);

        item.product.availableStock -= item.orderedQuantity;
        await productRepository.save(item.product);
      }

      return {
        ...savedOrder,
        total: this.calculateTotal(savedItems),
        };
    });
  }


  async findOne(id: number): Promise<Order & { total: string }> {
  const order = await this.orderRepository.findOne({
    where: { id },
    relations: {
      client: true,
      items: {
        product: true,
      },
    },
  });

  if (!order) {
    throw new NotFoundException(`Order ${id} was not found`);
  }

  return {
  ...order,
  total: this.calculateTotal(order.items),
};
}


async findAll(): Promise<(Order & { total: string })[]> {
  const orders = await this.orderRepository.find({
    relations: {
      client: true,
      items: true,
    },
    order: {
      createdAt: 'DESC',
      id: 'DESC',
    },
  });

  return orders.map((order) => ({
    ...order,
    total: this.calculateTotal(order.items),
  }));
}

}
