import { Product } from "@entities/product.entity";

export class ProductResponseDto {
    id: string;
    name: string;
    price: number;
    tags: { id: string; name: string }[];
    createdAt: Date;

    constructor(product: Product) {
        this.id = product.id;
        this.name = product.name;
        this.price = product.price;
        this.tags = (product.tags ?? []).map((t) => ({ id: t.id, name: t.name }));
        this.createdAt = product.createdAt;
    }

    static fromEntity(product: Product): ProductResponseDto {
        return new ProductResponseDto(product);
    }
}
