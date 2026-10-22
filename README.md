# my-font-hcaptcha

Uma fonte de teste com hCaptcha, para separar "o token é válido?" de "a fonte aceita o token?".
O formulário tem uma chave e o widget; o envio vai a uma função que confere o token no
`siteverify` do hCaptcha com o nosso secret e responde como uma fonte: consulta feita ou erro.

hcaptcha doc url: https://docs.hcaptcha.com/

## Arquivos

| Arquivo | O que faz |
| --- | --- |
| `index.html` | O formulário: campo `chave` e o widget (sitekey lida de `/api/sitekey`) |
| `api/sitekey.js` | Devolve a sitekey da variável de ambiente |
| `api/consulta.js` | `POST` com `chave` e `h-captcha-response` (ou `g-recaptcha-response`). Confere no `siteverify`. HTML para o navegador; com `Accept: application/json`, o veredito completo do hCaptcha |

## Respostas de `POST /api/consulta`

A fonte se chama **NotaLab** (fictícia) e segue o fluxo de uma consulta pública de chave: chave de acesso de
50 dígitos, captcha, consultar. Só a chave do `VALID_KEY` é encontrada. A ordem é a de uma fonte de verdade
(formato, captcha, busca), e cada erro diz qual dos três falhou:

| Caso | Status | `error` | `hcaptcha.success` |
| --- | --- | --- | --- |
| Chave encontrada | 200 | — (`ok: true`, com `nfse` fictícia) | `true` |
| Captcha ok, outra chave | 404 | `not-found` | `true` |
| Captcha recusado | 403 | `invalid-captcha` | `false` |
| Chave sem 50 dígitos | 400 | `invalid-key-format` | — (o token não é gasto) |
| Sem token | 400 | `missing-token` | — |
| `VALID_KEY` não configurada | 500 | `not-configured` | — |

Códigos de erro comuns do hCaptcha: `invalid-input-response` (token inválido), `invalid-or-already-seen-response`
(já usado ou vencido), `sitekey-secret-mismatch` (token de outra sitekey).

## Rodar localmente

`node dev-server.js` (porta 3000) serve a página e chama as mesmas funções de `api/`. Sem `.env`, usa as chaves de
teste públicas do hCaptcha: o widget aprova sem desafio e o `siteverify` responde de verdade. Uma sitekey real
não funciona em `localhost`, porque o hCaptcha só aceita os domínios cadastrados nela.

## Publicar na Vercel

1. No hCaptcha (dashboard.hcaptcha.com, conta gratuita): crie a sitekey e, em **Domains**, cadastre o domínio
   que a Vercel der ao projeto (ex.: `my-font-hcaptcha.vercel.app`). Copie também o secret da conta.
2. Publique a pasta: pelo painel da Vercel (importando um repositório com esta pasta) ou com
   `npx vercel deploy --prod` daqui.
3. Em **Settings → Environment Variables**, crie `HCAPTCHA_SITEKEY`, `HCAPTCHA_SECRET` e `VALID_KEY` (a chave de acesso de 50 dígitos), e publique de novo.
4. Abra a URL, informe a chave, resolva o captcha na mão e consulte: deve aparecer "Chave encontrada".

O `.env` local fica fora do git (`.gitignore`); o `.env.example` mostra as variáveis.

## Testar o solver contra ela

No Captcha Automation Layer, crie a tarefa com `websiteURL` igual à URL da Vercel e `websiteKey` igual à
sitekey. Depois envie o token a `POST /api/consulta` com `Accept: application/json`: o `hcaptcha.success`
diz se o hCaptcha aceitou o token, sem depender de nenhuma fonte real.
