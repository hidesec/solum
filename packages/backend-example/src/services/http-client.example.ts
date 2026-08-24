import { Bean } from "@solumjs/core";
import { HttpClient, HttpGet } from "@solumjs/http";
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
    getPost(params: { id: number }): Promise<JsonPlaceholderPost> {
        return fetch(`https://jsonplaceholder.typicode.com/posts/${params.id}`)
            .then((r) => r.json()) as any;
    }

    @HttpGet("/posts")
    getPosts(): Promise<JsonPlaceholderPost[]> {
        return fetch("https://jsonplaceholder.typicode.com/posts")
            .then((r) => r.json()) as any;
    }
}

/**
 * Example service demonstrating the declarative HTTP client pattern.
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
