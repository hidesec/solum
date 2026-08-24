import { JwtAuthGuard, PreAuthorize } from "@solumjs/auth";
import { SolumjsRequest } from "@solumjs/http";
import { parsePageable } from "@solumjs/http";
import { ProductResponseDto } from "@dto/product-response.dto";
import { CreateProductDto } from "@dto/create-product.dto";
import { IProductService } from "@services/product.service.interface";
import { AutoWired } from "@solumjs/core";
import { Body, Delete, Get, Param, Post, Query, Req, ResponseStatus, RestController, UseGuards, Valid } from "@solumjs/http";
import { ExceptionHandler } from "@solumjs/middlewares";
import { ConflictException } from "@solumjs/core";

@RestController("/products")
export class ProductController {
    @AutoWired("IProductService")
    declare private productService: IProductService;

    @Post("/")
    @ResponseStatus(201)
    @UseGuards(JwtAuthGuard)
    @PreAuthorize("hasRole('ADMIN')")
    async createProduct(@Valid({ whitelist: true }) @Body() dto: CreateProductDto, @Req() req: SolumjsRequest) {
        req.log.info({ body: { name: dto.name, price: dto.price } }, "Creating new product");
        const product = await this.productService.createProduct(dto);
        req.log.info({ productId: product.id }, "Product created successfully");
        return ProductResponseDto.fromEntity(product);
    }

    @Get("/")
    @ResponseStatus(200)
    async listProducts(@Query() query: Record<string, unknown>, @Req() req: SolumjsRequest) {
        const pageable = parsePageable(query);
        req.log.info({ page: pageable.page, size: pageable.size }, "Listing products");
        const page = await this.productService.findPage(pageable);
        return { ...page, content: page.content.map(ProductResponseDto.fromEntity) };
    }

    @Get("/:id")
    @ResponseStatus(200)
    async getProductById(@Param("id") id: string, @Req() req: SolumjsRequest) {
        req.log.info({ param: id }, "Get product by id");
        const product = await this.productService.getProductById(id);
        req.log.info({ param: id }, "Get product successfully");
        return ProductResponseDto.fromEntity(product);
    }

    @Delete("/:id")
    @ResponseStatus(200)
    @UseGuards(JwtAuthGuard)
    @PreAuthorize("hasRole('ADMIN')")
    async deleteProduct(@Param("id") id: string, @Req() req: SolumjsRequest) {
        req.log.info({ param: id }, "Deleting product");
        await this.productService.deleteProduct(id);
        return { status: "success", message: `Product ${id} deleted` };
    }

    @ExceptionHandler(ConflictException)
    handleDuplicateName(err: ConflictException, req: SolumjsRequest) {
        req.log.warn({ path: req.path }, err.message);
        return { status: "error", code: "PRODUCT_NAME_CONFLICT", message: err.message };
    }
}
