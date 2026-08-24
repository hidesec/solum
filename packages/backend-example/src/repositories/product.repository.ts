import { Bean } from "@solumjs/core";
import { BaseRepository } from "@solumjs/database";
import { IProductRepository } from "./product.repository.interface";
import { Product } from "@entities/product.entity";

@Bean("IProductRepository")
export class ProductRepository extends BaseRepository<Product, string> implements IProductRepository {
    protected readonly entityCtor = Product;

    async findByName(name: string): Promise<Product | null> {
        return this.query().where("name", name).first();
    }

    async findWithTags(id: string): Promise<Product | null> {
        return this.query().where("id", id).first();
    }
}
