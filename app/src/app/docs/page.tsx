"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ArrowLeft } from "lucide-react";
import "swagger-ui-dist/swagger-ui.css";

/** Documentação interativa da API (Swagger UI). A especificação vem de `/api/openapi.json`. */
export default function Docs() {
  const alvo = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelado = false;
    // O Swagger UI é grande: só é baixado quando alguém abre esta página.
    import("swagger-ui-dist/swagger-ui-bundle").then(({ default: SwaggerUIBundle }) => {
      if (cancelado || !alvo.current) return;
      SwaggerUIBundle({
        url: "/api/openapi.json",
        domNode: alvo.current,
        docExpansion: "list",
        deepLinking: true,
        defaultModelsExpandDepth: 0,
        tryItOutEnabled: true,
        // “Try it out” fala com o próprio site, levando o cookie de sessão de quem está logado.
        requestInterceptor: (req: { credentials?: string }) => {
          req.credentials = "same-origin";
          return req;
        },
      });
    });
    return () => {
      cancelado = true;
    };
  }, []);

  return (
    <div className="min-h-dvh bg-white text-[#14174f]">
      <header className="border-b-4 border-[#1b8fe6] bg-[#eef6fd]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <p className="font-display text-2xl font-extrabold italic text-[#1478d0]">Conecta Líderes · API</p>
            <p className="text-sm text-[#4f6489]">
              Especificação OpenAPI 3.1 ·{" "}
              <a href="/api/openapi.json" className="font-semibold underline">
                openapi.json
              </a>
            </p>
          </div>
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-bold text-[#1478d0] hover:underline">
            <ArrowLeft aria-hidden className="size-4" /> Voltar ao site
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-2 pb-16 sm:px-5">
        <div ref={alvo} />
      </main>
    </div>
  );
}
