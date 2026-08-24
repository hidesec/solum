import { CreateProductDto } from "@dto/create-product.dto";
import { Product } from "@entities/product.entity";
import { Page, PageRequest } from "@solumjs/http";

export interface IProductService {
    createProduct(dto: CreateProductDto): Promise<Product>;
    getProductById(id: string): Promise<Product>;
    findPage(request: PageRequest): Promise<Page<Product>>;
    deleteProduct(id: string): Promise<void>;
}
