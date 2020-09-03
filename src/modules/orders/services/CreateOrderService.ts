import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customerExist = await this.customersRepository.findById(customer_id);

    if (!customerExist) {
      throw new AppError("Customer don't created");
    }
    const existenProducts = await this.productsRepository.findAllById(products);

    if (!existenProducts.length) {
      throw new AppError('Could not find any products with the given ids');
    }
    const existenProductsIds = existenProducts.map(product => product.id);

    const checkInexistentProducts = products.filter(
      product => !existenProductsIds.includes(product.id),
    );
    if (checkInexistentProducts.length) {
      throw new AppError(
        `Could not find product ${checkInexistentProducts[0].id}`,
      );
    }
    const findProductsWithNoQuantityAvailable = products.filter(
      product =>
        existenProducts.filter(p => p.id === product.id)[0].quantity <
        product.quantity,
    );

    if (findProductsWithNoQuantityAvailable.length) {
      throw new AppError(
        `The quantity ${findProductsWithNoQuantityAvailable[0].quantity} is not available from ${findProductsWithNoQuantityAvailable[0].id}`,
      );
    }

    const serialiazedProducts = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: existenProducts.filter(p => p.id === product.id)[0].price,
    }));

    const order = await this.ordersRepository.create({
      customer: customerExist,
      products: serialiazedProducts,
    });

    const { order_products } = order;

    const orderedProductQuantity = order_products.map(product => ({
      id: product.product_id,
      quantity:
        existenProducts.filter(p => p.id === product.product_id)[0].quantity -
        product.quantity,
    }));

    await this.productsRepository.updateQuantity(orderedProductQuantity);

    return order;
  }
}

export default CreateOrderService;
