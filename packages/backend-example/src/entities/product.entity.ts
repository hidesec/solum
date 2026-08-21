import { Column, ColumnType, CreatedAtColumn, Entity, ManyToMany, PrimaryGeneratedColumn } from "@solumjs/orm";
import { Tag } from "./tag.entity";

@Entity("products")
export class Product {
    @PrimaryGeneratedColumn(ColumnType.UUID)
    id!: string;

    @Column({ type: ColumnType.VARCHAR, length: 255 })
    name!: string;

    @Column({ type: ColumnType.DECIMAL, precision: 12, scale: 2 })
    price!: number;

    @ManyToMany(() => Tag)
    tags!: Tag[];

    @CreatedAtColumn()
    createdAt!: Date;

    constructor(id:string, name: string, price: number, createdAt: Date = new Date()) {
        this.id = id;
        this.name = name;
        this.price = price;
        this.createdAt = createdAt;
    }
}