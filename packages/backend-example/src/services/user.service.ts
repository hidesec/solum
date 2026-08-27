import { IUserRepository } from "@repositories/user.repository.interface";
import { IUserService } from "./user.service.interface";
import { CreateUserDto } from "@dto/create-user.dto";
import { User } from "@entities/user.entity";
import { BadRequestException, ConflictException, NotFoundException } from "@solumjs/core";
import { inject } from "@solumjs/core";
import { randomUUID } from "crypto";
import { Transactional } from "@solumjs/database";
import { Auditable, LogExecution } from "@solumjs/aop";
import { Bean, PostConstruct } from "@solumjs/core";
import { CacheEvict, Cacheable } from "@solumjs/cache";
import { Page, PageRequest } from "@solumjs/http";
import { IEventBus } from "@solumjs/events";
import { hashPassword } from "@solumjs/auth";
import { UserRole } from "@solumjs/auth";
import { logger } from "@config/logger";

@Bean("IUserService")
export class UserService implements IUserService {
    constructor(
        @inject("IUserRepository")
        private readonly userRepository: IUserRepository,
        @inject("IEventBus")
        private readonly eventBus: IEventBus
    ) {}

    @PostConstruct()
    init() {
        logger.info("[@PostConstruct] UserService initialized")
    }

    @Transactional()
    @Auditable("USER_CREATED")
    @LogExecution()
    async createUser(dto: CreateUserDto): Promise<User> {
        const id = randomUUID();
        const normalizedEmail = dto.email.toLowerCase().trim();
        const existing = await this.userRepository.findByEmail(normalizedEmail);
        if(existing) {
            throw new ConflictException(`Email ${normalizedEmail} is already registered`);
        }

        const user = new User(id, dto.name, normalizedEmail);
        user.passwordHash = hashPassword(dto.password);

        const saved = await this.userRepository.save(user);
        await this.eventBus.publish("USER_CREATED", { userId: saved.id, email: saved.email });
        return saved;
    }

    @Auditable("GET_USER")
    @LogExecution()
    @Cacheable("users", 30)
    async getUserById(id: string): Promise<User> {
        const user = await this.userRepository.findById(id);
        if (!user) {
            throw new NotFoundException(`User with id ${id} not found`);
        }
        return user;
    }

    @LogExecution()
    async findRecentByEmails(emails: string[], limit: number): Promise<User[]> {
        if (emails.length === 0) {
            throw new BadRequestException("emails must not be empty");
        }
        return this.userRepository.findRecentByEmails(emails, limit);
    }

    @LogExecution()
    async findPage(request: PageRequest): Promise<Page<User>> {
        return this.userRepository.findPage(request);
    }

    @Transactional()
    @Auditable("USER_DELETED")
    @LogExecution()
    @CacheEvict("users")
    async deleteUser(id: string): Promise<void> {
        const user = await this.userRepository.findById(id);
        if (!user) {
            throw new NotFoundException(`User with id ${id} not found`);
        }
        await this.userRepository.deleteById(id);
    }

    @Transactional()
    @Auditable("USER_ROLE_UPDATED")
    @LogExecution()
    @CacheEvict("users")
    async updateRole(id: string, role: UserRole): Promise<User> {
        const user = await this.userRepository.findById(id);
        if (!user) {
            throw new NotFoundException(`User with id ${id} not found`);
        }
        user.role = role;
        return this.userRepository.save(user);
    }
}
