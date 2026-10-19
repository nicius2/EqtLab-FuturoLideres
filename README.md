# Conecta Líderes · EQT Lab

Desafio 6 do Hackathon Equatorial — plataforma de desenvolvimento para líderes recém-promovidos.

| Pasta | Conteúdo |
|---|---|
| [`app/`](app/) | Aplicação Next.js (front + API). Veja o [README do app](app/README.md). |
| [`docker-compose.yml`](docker-compose.yml) | Banco PostgreSQL local (imagem Bitnami). |
| [`prompt-futuros-lideres.md`](prompt-futuros-lideres.md) | Especificação do produto. |

## Qualidade e documentação

- **CI:** [`.github/workflows/ci.yml`](.github/workflows/ci.yml) roda lint, tipos, testes unitários, testes de API (com Postgres) e build em todo pull request.
- **Testes:** `pnpm test` (unitários) e `pnpm test:api` (API, contra banco local). Detalhes no [README do app](app/README.md#testes).
- **Documentação da API:** Swagger em `/docs` e a especificação OpenAPI em `/api/openapi.json`.

## Banco de dados (PostgreSQL)

```bash
cp .env.example .env     # opcional: os valores padrão já funcionam
docker compose up -d     # sobe o Postgres e espera ficar saudável
docker compose down      # para (os dados ficam no volume); use `down -v` para apagar tudo
```

Conexão padrão: `postgresql://futuro:futuro_dev@localhost:5434/futuro_lideres` (porta 5434 para não colidir com outros Postgres locais; mude com `POSTGRES_PORT`).

> A imagem é `bitnamilegacy/postgresql`: a Bitnami moveu as tags versionadas para esse namespace e o `bitnami/postgresql` só mantém a tag `latest`. O app ainda não lê o banco — hoje o estado fica no navegador (veja “Para a equipe de back-end” no README do app).

## Deploy na Vercel

1. Importe este repositório na Vercel.
2. Em **Root Directory**, escolha `app`.
3. Framework: Next.js (detectado automaticamente). Não é preciso variável de ambiente: sem `IA_PROVEDOR`, a avaliação usa o modo simulado.
4. Deploy.
