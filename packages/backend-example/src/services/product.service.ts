import { IProductRepository } from "@repositories/product.repository.interface";
import { ITagRepository } from "@repositories/tag.repository.interface";
import { IProductService } from "./product.service.interface";
import { CreateProductDto } from "@dto/create-product.dto";
import { Product } from "@entities/product.entity";
import { ConflictException, NotFoundException, inject } from "@solumjs/core";
import { Bean } from "@solumjs/core";
import { randomUUID } from "crypto";
import { Transactional } from "@solumjs/database";
import { Auditable, LogExecution } from "@solumjs/aop";
import { CacheEvict, Cacheable } from "@solumjs/cache";
import { Page, PageRequest } from "@solumjs/http";
import { logger } from "@config/logger";

@Bean("IProductService")
export class ProductService implements IProductService {
    constructor(
        @inject("IProductRepository")
        private readonly productRepository: IProductRepository,
        @inject("ITagRepository")
        private readonly tagRepository: ITagRepository
    ) {}

    @Transactional()
    @Auditable("PRODUCT_CREATED")
    @LogExecution()
    async createProduct(dto: CreateProductDto): Promise<Product> {
        const id = randomUUID();
        const existing = await this.productRepository.findByName(dto.name);
        if (existing) {
            throw new ConflictException(`Product "${dto.name}" already exists`);
        }

        const product = new Product(id, dto.name, dto.price);

        if (dto.tagIds && dto.tagIds.length > 0) {
            product.tags = await this.tagRepository.findByIds(dto.tagIds);
        }

        const saved = await this.productRepository.save(product);
        logger.info({ productId: saved.id, name: saved.name }, "Product created");
        return saved;
    }

    @Auditable("GET_PRODUCT")
    @LogExecution()
    @Cacheable("products", 60)
    async getProductById(id: string): Promise<Product> {
        const product = await this.productRepository.findById(id);
        if (!product) {
            throw new NotFoundException(`Product with id ${id} not found`);
        }
        return product;
    }

    @LogExecution()
    async findPage(request: PageRequest): Promise<Page<Product>> {
        return this.productRepository.findPage(request);
    }

    @Transactional()
    @Auditable("PRODUCT_DELETED")
    @LogExecution()
    @CacheEvict("products")
    async deleteProduct(id: string): Promise<void> {
        const product = await this.productRepository.findById(id);
        if (!product) {
            throw new NotFoundException(`Product with id ${id} not found`);
        }
        await this.productRepository.deleteById(id);
    }
}
