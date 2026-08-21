import { Column, ColumnType, Entity, PrimaryGeneratedColumn } from "@solumjs/orm";

@Entity("tags")
export class Tag {
    @PrimaryGeneratedColumn(ColumnType.UUID)
    id!: string;

    @Column({ type: ColumnType.VARCHAR, length: 100, unique: true })
    name!: string;
}