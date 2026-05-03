const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { analyzeBidPackage } = require("./lib/analyzer");

const PORT = Number(process.env.PORT || 3000);
const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, "public");

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8"
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload, null, 2));
}

function sendText(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  response.end(payload);
}

function resolveStaticPath(urlPath) {
  const decodedPath = decodeURIComponent(urlPath.split("?")[0]);
  if (decodedPath === "/" || decodedPath === "") {
    return path.join(PUBLIC_DIR, "index.html");
  }

  const normalizedPath = path.normalize(decodedPath).replace(/^(\.\.[/\\])+/, "");
  const candidate = path.join(ROOT_DIR, normalizedPath);
  if (!candidate.startsWith(ROOT_DIR)) {
    return null;
  }
  return candidate;
}

function serveStaticFile(response, filePath) {
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === "ENOENT") {
        sendJson(response, 404, { error: "Not Found" });
        return;
      }
      sendJson(response, 500, { error: "Failed to read file" });
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": MIME_TYPES[extension] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    response.end(content);
  });
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > 5 * 1024 * 1024) {
        reject(new Error("Payload too large"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });

    request.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });

    request.on("error", reject);
  });
}

const server = http.createServer(async (request, response) => {
  if (!request.url) {
    sendJson(response, 400, { error: "Invalid request" });
    return;
  }

  if (request.method === "GET" && request.url === "/api/health") {
    sendJson(response, 200, {
      status: "ok",
      service: "medbid-guard-mvp",
      port: PORT
    });
    return;
  }

  if (request.method === "POST" && request.url === "/api/analyze") {
    try {
      const payload = await readJsonBody(request);
      const result = analyzeBidPackage(payload);
      sendJson(response, 200, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      const statusCode = message === "Payload too large" ? 413 : 400;
      sendJson(response, statusCode, { error: message });
    }
    return;
  }

  if (request.method !== "GET") {
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  const filePath = resolveStaticPath(request.url);
  if (!filePath) {
    sendJson(response, 400, { error: "Invalid path" });
    return;
  }

  serveStaticFile(response, filePath);
});

server.listen(PORT, () => {
  process.stdout.write(`MedBid Guard MVP running at http://localhost:${PORT}\n`);
});
