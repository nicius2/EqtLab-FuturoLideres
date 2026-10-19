import { describe, expect, it } from "vitest";
import { AREAS_PADRAO, urlSegura } from "./areas";

describe("urlSegura (o app só abre links https:)", () => {
  it("aceita https", () => expect(urlSegura("https://meet.google.com/abc-defg-hij")).toBe("https://meet.google.com/abc-defg-hij"));
  it.each(["http://meet.google.com", "javascript:alert(1)", "data:text/html,<script>", "ftp://x.com", "meet.google.com", "", null, undefined])(
    "recusa %s",
    (u) => expect(urlSegura(u as string | null | undefined)).toBeNull(),
  );
});

describe("áreas padrão", () => {
  it("são as 4 áreas, em ordem, com slug e cor válidos", () => {
    expect(AREAS_PADRAO.map((a) => a.slug)).toEqual(["comercial", "vendas", "marketing", "operarios"]);
    for (const a of AREAS_PADRAO) {
      expect(a.slug).toMatch(/^[a-z0-9-]{2,40}$/);
      expect(a.cor).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});
