import { JwtAuthGuard, PreAuthorize } from "@solumjs/auth";
import { JwtPayload } from "@solumjs/auth";
import { UserRole } from "@solumjs/auth";
import { SolumjsRequest } from "@solumjs/http";
import { parsePageable } from "@solumjs/http";
import { UserResponseDto } from "@dto/user-response.dto";
import { CreateUserDto } from "@dto/create-user.dto";
import { UpdateRoleDto } from "@dto/update-role.dto";
import { IUserService } from "@services/user.service.interface";
import { AutoWired } from "@solumjs/core";
import { Body, CurrentUser, Delete, Get, Param, Patch, Post, Query, Req, ResponseStatus, RestController, UseGuards, Valid } from "@solumjs/http";
import { ExceptionHandler } from "@solumjs/middlewares";
import { ConflictException, ForbiddenException, InvalidQueryParameterException } from "@solumjs/core";

const registrationAttempts = new Map<string, { count: number; resetAt: number }>();
const REGISTRATION_LIMIT = 5;
const REGISTRATION_WINDOW_MS = 15 * 60 * 1000;

function checkRegistrationRateLimit(ip: string): void {
    const now = Date.now();
    let bucket = registrationAttempts.get(ip);
    if (!bucket || bucket.resetAt <= now) {
        bucket = { count: 0, resetAt: now + REGISTRATION_WINDOW_MS };
        registrationAttempts.set(ip, bucket);
    }
    bucket.count++;
    if (bucket.count > REGISTRATION_LIMIT) {
        throw new ConflictException("Too many registration attempts. Please try again later.");
    }
}

@RestController("/users")
export class UserController {
    @AutoWired("IUserService")
    declare private userService: IUserService;

    @Post("/")
    @ResponseStatus(201)
    async createUser(@Valid({ whitelist: true }) @Body() dto: CreateUserDto, @Req() req: SolumjsRequest) {
        const ip = req.raw.socket?.remoteAddress ?? "unknown";
        checkRegistrationRateLimit(ip);

        req.log.info({ body: { email: dto.email } }, "Creating new user");
        const user = await this.userService.createUser(dto);
        req.log.info({ userId: user.id }, "User created successfully");
        return UserResponseDto.fromEntity(user);
    }

    @Get("/recent")
    @ResponseStatus(200)
    @UseGuards(JwtAuthGuard)
    @PreAuthorize("hasRole('ADMIN')")
    async findRecentByEmails(
        @Query("emails") emails: string,
        @Query("limit") limit: string,
        @Req() req: SolumjsRequest
    ) {
        const emailList = (emails ?? "")
            .split(",")
            .map((e) => e.trim())
            .filter(Boolean);

        if (emailList.length === 0) {
            throw new InvalidQueryParameterException("Query param 'emails' is required (comma-separated list of emails)");
        }

        const parsedLimit = Math.min(Math.max(parseInt(limit ?? "10", 10) || 10, 1), 100);

        req.log.info({ emails: emailList, limit: parsedLimit }, "Finding recent users by emails");

        const users = await this.userService.findRecentByEmails(emailList, parsedLimit);
        return users.map(UserResponseDto.fromEntity);
    }

    @Get("/")
    @ResponseStatus(200)
    @UseGuards(JwtAuthGuard)
    @PreAuthorize("hasRole('ADMIN')")
    async listUsers(@Query() query: Record<string, unknown>, @Req() req: SolumjsRequest) {
        const pageable = parsePageable(query);
        req.log.info({ page: pageable.page, size: pageable.size, sorts: pageable.sorts }, "Listing users");
        const page = await this.userService.findPage(pageable);
        return { ...page, content: page.content.map(UserResponseDto.fromEntity) };
    }

    @Get("/me")
    @ResponseStatus(200)
    @UseGuards(JwtAuthGuard)
    @PreAuthorize("isAuthenticated()")
    async me(@CurrentUser() principal: JwtPayload, @Req() req: SolumjsRequest) {
        req.log.info({ userId: principal.sub }, "Fetching current user profile");
        return UserResponseDto.fromEntity(await this.userService.getUserById(principal.sub));
    }

    @Get("/:id")
    @ResponseStatus(200)
    @UseGuards(JwtAuthGuard)
    @PreAuthorize("isAuthenticated()")
    async getUserById(@Param("id") id: string, @CurrentUser() principal: JwtPayload, @Req() req: SolumjsRequest) {
        req.log.info({ param: id }, "Get user by id");

        if (principal.sub !== id && principal.role !== "ADMIN") {
            req.log.warn({ userId: principal.sub, targetId: id }, "IDOR attempt blocked");
            throw new ForbiddenException("You can only access your own profile");
        }

        const user = await this.userService.getUserById(id);

        req.log.info({ param: id }, "Get user successfully");
        return UserResponseDto.fromEntity(user);
    }

    @Delete("/:id")
    @ResponseStatus(200)
    @UseGuards(JwtAuthGuard)
    @PreAuthorize("hasRole('ADMIN')")
    async deleteUser(@Param("id") id: string, @Req() req: SolumjsRequest) {
        req.log.info({ param: id }, "Deleting user");
        await this.userService.deleteUser(id);
        return { status: "success", message: `User ${id} deleted` };
    }

    @Patch("/:id/role")
    @ResponseStatus(200)
    @UseGuards(JwtAuthGuard)
    @PreAuthorize("hasRole('ADMIN')")
    async updateRole(
        @Param("id") id: string,
        @Valid() @Body() dto: UpdateRoleDto,
        @CurrentUser() principal: JwtPayload,
        @Req() req: SolumjsRequest
    ): Promise<UserResponseDto> {
        if (principal.sub === id) {
            throw new ForbiddenException("Cannot change your own role");
        }
        req.log.info({ param: id, role: dto.role }, "Updating user role");
        return UserResponseDto.fromEntity(await this.userService.updateRole(id, dto.role as UserRole));
    }

    @ExceptionHandler(ConflictException)
    handleDuplicateEmail(err: ConflictException, req: SolumjsRequest) {
        req.log.warn({ path: req.path }, err.message);
        return { status: "error", code: "USER_EMAIL_CONFLICT", message: err.message };
    }
}
