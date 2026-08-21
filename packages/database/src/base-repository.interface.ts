import { Page, PageRequest } from "@solumjs/http";

export interface IBaseRepository<T, ID> {
    findById(id: ID): Promise<T | null>;
    findAll(): Promise<T[]>;
    findAllById(ids: ID[]): Promise<T[]>;
    findPage(request: PageRequest): Promise<Page<T>>;
    existsById(id: ID): Promise<boolean>;
    count(): Promise<number>;
    save(entity: T): Promise<T>;
    deleteById(id: ID): Promise<void>;
    delete(entity: T): Promise<void>;
}
