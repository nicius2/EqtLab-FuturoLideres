import { NextResponse } from "next/server";
import { especificacaoOpenApi } from "@/lib/openapi";

/** GET /api/openapi.json — a especificação OpenAPI 3.1 da API (lida pelo Swagger UI em /docs). */
export function GET() {
  return NextResponse.json(especificacaoOpenApi());
}
