// Servidor local que imita a Vercel: serve o index.html e chama as mesmas funções de api/.
//   node dev-server.js   (porta 3000; PORT muda)
// Sem .env, usa as chaves de teste públicas do hCaptcha (o widget aprova direto e o siteverify
// responde de verdade). A chave válida vem sempre do .env (VALID_KEY). Uma sitekey real não funciona em localhost:
// o hCaptcha recusa o domínio.
import { readFileSync, existsSync } from "node:fs";
import { createServer } from "node:http";

const TEST_KEYS = {
  HCAPTCHA_SITEKEY: "10000000-ffff-ffff-ffff-000000000001",
  HCAPTCHA_SECRET: "0x0000000000000000000000000000000000000000",
};

if (existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (match && match[2]) process.env[match[1]] ??= match[2];
  }
}
for (const [key, value] of Object.entries(TEST_KEYS)) process.env[key] ||= value;

const routes = {
  "/api/consulta": (await import("./api/consulta.js")).default,
  "/api/sitekey": (await import("./api/sitekey.js")).default,
};

function readBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      const type = req.headers["content-type"] || "";
      if (type.includes("application/json")) resolve(raw ? JSON.parse(raw) : {});
      else resolve(Object.fromEntries(new URLSearchParams(raw)));
    });
  });
}

// O mesmo res que a Vercel entrega às funções: status(), json() e send().
function vercelResponse(res) {
  return {
    status(code) {
      res.statusCode = code;
      return this;
    },
    json(value) {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(value));
    },
    send(text) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(text);
    },
  };
}

createServer(async (req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  const handler = routes[path];
  if (handler) {
    req.body = req.method === "POST" ? await readBody(req) : {};
    await handler(req, vercelResponse(res));
    return;
  }
  if (path === "/" || path === "/index.html") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(readFileSync("index.html"));
    return;
  }
  res.statusCode = 404;
  res.end("not found");
}).listen(process.env.PORT || 3000, "127.0.0.1", () => {
  const test = process.env.HCAPTCHA_SITEKEY === TEST_KEYS.HCAPTCHA_SITEKEY;
  const keys = test ? "chaves de teste do hCaptcha" : "chaves do .env";
  console.log(`http://127.0.0.1:${process.env.PORT || 3000} (${keys}; chave válida: ${process.env.VALID_KEY})`);
});
