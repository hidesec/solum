import { Product } from "@entities/product.entity";
import { IBaseRepository } from "@solumjs/database";

export interface IProductRepository extends IBaseRepository<Product, string> {
    findByName(name: string): Promise<Product | null>;
    findWithTags(id: string): Promise<Product | null>;
}
