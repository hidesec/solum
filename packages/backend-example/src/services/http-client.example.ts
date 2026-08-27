import { Bean } from "@solumjs/core";
import { HttpClient, HttpGet, makeRequest, RequestOptions } from "@solumjs/http";
import { logger } from "@config/logger";

interface JsonPlaceholderPost {
    userId: number;
    id: number;
    title: string;
    body: string;
}

@HttpClient({ baseUrl: "https://jsonplaceholder.typicode.com" })
export class HttpPlaceholderClient {
    @HttpGet("/posts/:id")
    async getPost(params: { id: number }): Promise<JsonPlaceholderPost> {
        const res = await makeRequest({
            method: "GET",
            url: `https://jsonplaceholder.typicode.com/posts/${params.id}`,
            timeout: 10000,
        });
        return res as JsonPlaceholderPost;
    }

    @HttpGet("/posts")
    async getPosts(): Promise<JsonPlaceholderPost[]> {
        const res = await makeRequest({
            method: "GET",
            url: "https://jsonplaceholder.typicode.com/posts",
            timeout: 10000,
        });
        return res as JsonPlaceholderPost[];
    }
}

/**
 * Example service demonstrating the declarative HTTP client pattern.
 * Uses makeRequest() for SSRF-protected HTTP calls instead of raw fetch().
 * HttpPlaceholderClient is a proxy that intercepts method calls and
 * makes HTTP requests based on the @HttpClient and @HttpGet decorators.
 */
@Bean()
export class ExternalApiService {
    async fetchPost(id: number): Promise<JsonPlaceholderPost | null> {
        try {
            const client = new HttpPlaceholderClient() as any;
            const post = await client.getPost({ id });
            logger.info({ postId: post.id }, "[ExternalApi] Fetched post");
            return post;
        } catch (err) {
            logger.error({ err, postId: id }, "[ExternalApi] Failed to fetch post");
            return null;
        }
    }

    async fetchPosts(): Promise<JsonPlaceholderPost[]> {
        try {
            const client = new HttpPlaceholderClient() as any;
            const posts = await client.getPosts();
            logger.info({ count: posts.length }, "[ExternalApi] Fetched posts");
            return posts;
        } catch (err) {
            logger.error({ err }, "[ExternalApi] Failed to fetch posts");
            return [];
        }
    }
}
