type MongoDbHandle = {
    command(options: object): Promise<Record<string, unknown>>;
    databaseName: string;
};

type MongoClientV6 = {
    connect(): Promise<void>;
    db(name?: string): MongoDbHandle;
    close(): Promise<void>;
};

export async function connectMongo(url: string): Promise<MongoDbHandle> {
    let mongodb: { MongoClient: new (url: string, options?: object) => MongoClientV6 };
    try {
        const moduleName = "mongodb";
        mongodb = (await import(moduleName)) as unknown as {
            MongoClient: new (url: string, options?: object) => MongoClientV6;
        };
    } catch {
        throw new Error('MONGO_URL is set but the "mongodb" package is not installed. Install it with: npm install mongodb');
    }

    const client = new mongodb.MongoClient(url, { serverSelectionTimeoutMS: 5_000 });
    await client.connect();
    return client.db();
}
