import { Column, ColumnType, CreatedAtColumn, Entity, PrimaryGeneratedColumn } from "@solumjs/orm";

@Entity("users")
export class User {
    @PrimaryGeneratedColumn(ColumnType.UUID)
    public readonly id!: string;

    @Column({ type: ColumnType.VARCHAR, length: 255 })
    public name!: string;

    @Column({ type: ColumnType.VARCHAR, length: 255, unique: true })
    public email!: string;

    @Column({ type: ColumnType.VARCHAR, length: 255, nullable: true })
    public passwordHash?: string;

    @Column({ type: ColumnType.VARCHAR, length: 32, default: "'USER'" })
    public role!: string;

    @CreatedAtColumn()
    public readonly createdAt!: Date;

    constructor(id: string, name: string, email: string, createdAt: Date = new Date(), role: string = "USER") {
        this.id = id;
        this.name = name;
        this.email = email;
        this.role = role;
        this.createdAt = createdAt;
    }
}
