// Responde como uma consulta pública de chave: confere o formato da chave de acesso (50 dígitos), o
// token no hCaptcha (siteverify) e, por fim, se a chave é a única cadastrada (VALID_KEY). A resposta
// separa os sinais, para um erro de chave nunca parecer erro de captcha. O formulário em HTML puro
// recebe uma página; com Accept: application/json, o JSON abaixo.
const SITEVERIFY = "https://api.hcaptcha.com/siteverify";
const KEY_FORMAT = /^\d{50}$/;

async function verify(token, remoteip) {
  const form = new URLSearchParams({
    secret: process.env.HCAPTCHA_SECRET || "",
    response: token,
    sitekey: process.env.HCAPTCHA_SITEKEY || "",
  });
  if (remoteip) form.set("remoteip", remoteip);
  const response = await fetch(SITEVERIFY, { method: "POST", body: form });
  return response.json();
}

// Dados fictícios da nota encontrada: a fonte é de teste, o que importa é a consulta ter passado.
function note(chave) {
  return {
    chave,
    numero: Number(chave.slice(23, 36)) || 1,
    emissao: "2026-10-01",
    situacao: "Normal",
    prestador: { documento: chave.slice(9, 23), nome: "Prestador de Testes Ltda" },
    tomador: { nome: "Tomador de Testes" },
    servico: "Serviço de teste",
    valor: 1500.0,
  };
}

const MESSAGES = {
  "invalid-key-format": "A chave de acesso deve ter 50 dígitos.",
  "missing-token": "Complete o desafio do hCaptcha.",
  "invalid-captcha": "Captcha recusado pelo hCaptcha.",
  "not-found": "Nenhum registro encontrado para a chave informada.",
  "not-configured": "A fonte não tem VALID_KEY configurada.",
  "siteverify-unreachable": "O hCaptcha não respondeu.",
};

const escape = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

function page(result) {
  const title = result.ok ? "Chave encontrada" : "Erro na consulta";
  const detail = result.ok ? `Chave ${escape(result.chave)}` : MESSAGES[result.error];
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family: system-ui, sans-serif; max-width: 520px; margin: 40px auto">
<h1>${title}</h1><p>${detail}</p><p><a href="/">Nova consulta</a></p></body></html>`;
}

function reply(req, res, status, result) {
  if ((req.headers.accept || "").includes("application/json")) res.status(status).json(result);
  else res.status(status).send(page(result));
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "use POST" });
    return;
  }
  const body = req.body || {};
  const chave = String(body.chave || "").replace(/\D/g, "");
  // O widget preenche os dois campos; bots costumam mandar um só.
  const token = String(body["h-captcha-response"] || body["g-recaptcha-response"] || "");
  const validKey = (process.env.VALID_KEY || "").replace(/\D/g, "");

  if (!validKey) return reply(req, res, 500, { ok: false, chave, error: "not-configured" });
  // O formato é conferido antes do captcha, como faria a fonte: o token não é gasto à toa.
  if (!KEY_FORMAT.test(chave)) return reply(req, res, 400, { ok: false, chave, error: "invalid-key-format" });
  if (!token) return reply(req, res, 400, { ok: false, chave, error: "missing-token" });

  const remoteip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  let hcaptcha;
  try {
    hcaptcha = await verify(token, remoteip);
  } catch (error) {
    return reply(req, res, 502, { ok: false, chave, error: "siteverify-unreachable", detail: String(error) });
  }
  if (hcaptcha.success !== true) {
    return reply(req, res, 403, { ok: false, chave, error: "invalid-captcha", hcaptcha });
  }
  if (chave !== validKey) return reply(req, res, 404, { ok: false, chave, error: "not-found", hcaptcha });
  return reply(req, res, 200, { ok: true, chave, nfse: note(chave), hcaptcha });
}
