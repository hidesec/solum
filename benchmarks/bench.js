const http = require("http");

function createSolumServer() {
    const routes = new Map();

    function addRoute(method, path, handler) {
        const key = `${method}:${path}`;
        routes.set(key, handler);
    }

    function handleRequest(req, res) {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const path = url.pathname;
        const method = req.method;

        for (const [key, handler] of routes) {
            const [routeMethod, routePath] = key.split(":");
            if (routeMethod === method && routePath === path) {
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(handler()));
                return;
            }
        }

        res.writeHead(404);
        res.end("Not Found");
    }

    const server = http.createServer(handleRequest);

    return {
        get: (path, handler) => addRoute("GET", path, handler),
        listen: (port) => new Promise((resolve) => server.listen(port, resolve)),
        close: () => new Promise((resolve) => server.close(resolve)),
    };
}

async function runBenchmark(name, handler, duration = 3000) {
    return new Promise((resolve) => {
        const results = [];
        let running = true;
        let connections = 0;
        let completed = 0;
        let errors = 0;

        const interval = setInterval(() => {
            if (!running) return;
            for (let i = 0; i < 10; i++) {
                connections++;
                handler()
                    .then(() => { completed++; connections--; })
                    .catch(() => { errors++; connections--; });
            }
        }, 10);

        setTimeout(() => {
            running = false;
            clearInterval(interval);
            const rps = Math.round((completed / duration) * 1000);
            resolve({ name, rps, completed, errors, duration });
        }, duration);
    });
}

async function main() {
    console.log("🏃 SolumJS HTTP Benchmark");
    console.log("═".repeat(50));

    const server = createSolumServer();
    server.get("/json", () => ({ message: "Hello, World!" }));
    server.get("/text", () => "Hello, World!");

    const PORT = 3456;
    await server.listen(PORT);

    const makeRequest = (path) => {
        return new Promise((resolve, reject) => {
            http.get(`http://127.0.0.1:${PORT}${path}`, (res) => {
                let data = "";
                res.on("data", (chunk) => { data += chunk; });
                res.on("end", () => resolve(data));
            }).on("error", reject);
        });
    };

    const result = await runBenchmark("SolumJS (custom router)", () => makeRequest("/json"), 3000);

    console.log(`\n  ${result.name}`);
    console.log(`  ${result.rps.toLocaleString()} req/s`);
    console.log(`  Total requests: ${result.completed.toLocaleString()}`);
    console.log(`  Errors: ${result.errors}`);
    console.log("\n  Note: This is a minimal HTTP server benchmark.");
    console.log("  For framework-level benchmarks, use 'autocannon' or 'wrk'.");
    console.log("");

    await server.close();
}

main().catch(console.error);
