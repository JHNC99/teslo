import { NotFoundException } from '@nestjs/common';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

import { validate as isUUID } from 'uuid';
import { InjectRepository } from '@nestjs/typeorm';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { Repository, DataSource } from 'typeorm';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductImage, Product } from './entities';

@Injectable()
export class ProductsService {
  /***
   * @author Jonathan Hernández <hernandezcastellanosjonathan@gmail.com
   * @returns {error} ;
   * 
   }
   */
  private readonly logger = new Logger('ProductsService');

  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>, //Hacer inserciones, query builders
    @InjectRepository(ProductImage)
    private readonly productImageRepository: Repository<ProductImage>,

    private readonly dataSource: DataSource,
  ) {}

  /***
   * It is for  save new product at DB in the table product.
   * @author Jonathan Hernández <hernandezcastellanosjonathan@gmail.com>
   * @function
   * @param {object} createProductDto - product properties
   * @returns {object} -success product create
   *
   */
  async create(createProductDto: CreateProductDto) {
    try {
      const { images = [], ...productDetails } = createProductDto; //restoperator
      const product = this.productRepository.create({
        //spread operator
        ...productDetails,
        images: images.map((image) =>
          this.productImageRepository.create({ url: image }),
        ),
      }); //Instancia el producto con sus propiedades
      await this.productRepository.save(product); //Inserta el producto
      return { ...product, images };
    } catch (err) {
      this.handleExeption(err);
    }
  }

  /****
   *
   * It is for update a product
   * @author Jonathan Hernández <hernandezcastellanosjonathan@gmail.com>
   * @function
   * @param {object} CreateProductDto - prodcuct properties
   * @returns {object}- product update
   */

  async findAll(paginationDto: PaginationDto) {
    const { limit = 10, offset = 0 } = paginationDto;
    const products = await this.productRepository.find({
      take: limit,
      skip: offset,
      //TODO: Relaciones
      relations: {
        images: true,
      },
    });
    return products.map((product) => ({
      ...product,
      images: product.images.map((image) => image.url),
    }));
  }

  async findOne(term: string) {
    let product: Product;

    if (isUUID(term)) {
      product = await this.productRepository.findOneBy({
        id: term,
      });
    } else {
      const queryBuilder = this.productRepository.createQueryBuilder('product'); //Instance
      product = await queryBuilder
        .where('UPPER(title)=:title or slug=:slug', {
          title: term.toUpperCase(),
          slug: term.toLocaleLowerCase(),
        })
        .leftJoinAndSelect('product.images', 'images')
        .getOne();
    }

    if (!product) {
      throw new NotFoundException(`Product with is ${term} not found`);
    }
    return product;
  }

  async findOnePlainOne(term: string) {
    const { images = [], ...product } = await this.findOne(term);
    return {
      ...product,
      images: images.map((image) => image.url),
    };
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    const { images, ...toUpdate } = updateProductDto;
    const product = await this.productRepository.preload({
      id: id,
      ...toUpdate,
    });
    if (!product)
      throw new NotFoundException(`Product with id ${id} not found`);

    //Create query runner
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      if (images) {
        await queryRunner.manager.delete(ProductImage, { product: { id } });
        product.images = images.map((image) =>
          this.productImageRepository.create({ url: image }),
        );
      }
      // await this.productRepository.save(product);
      // return product;
      await queryRunner.manager.save(product);
      await queryRunner.commitTransaction();
      return this.findOnePlainOne(id);
    } catch (err) {
      this.handleExeption(err);
    }
  }

  async remove(id: string) {
    const product = await this.productRepository.findOneBy({ id });
    if (product) {
      this.productRepository.remove(product);
      return product;
    }
    throw new NotFoundException(`Product with id ${id} not found`);
  }

  /***
   * @param {object}
   * @returns {Exception}
   * @description It is for handle exception
   */
  private handleExeption(error: any) {
    if (error.code === '23505') throw new BadRequestException(error.detail);
    this.logger.error(error);
    throw new InternalServerErrorException('Help me');
  }

  async deleteAllProducts() {
    const query = this.productRepository.createQueryBuilder('product');
    try {
      return await query.delete().where(/* 'id IS NOT NULL' */ {}).execute();
    } catch (err) {
      this.handleExeption(err);
    }
  }
}
