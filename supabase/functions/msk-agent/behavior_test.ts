import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { clarificationFor, classifyIntent } from "./behavior.ts";

Deno.test("pergunta com alvo e resultado concreto executa como edição", () => {
  assertEquals(classifyIntent("como deixar o fundo do botão laranja?").kind, "edit");
});

Deno.test("pergunta informativa continua no modo conversa", () => {
  assertEquals(classifyIntent("como funciona o projeto?").kind, "question");
});

Deno.test("pedido visual concreto não pede esclarecimento", () => {
  assertEquals(clarificationFor("mude o fundo para laranja"), null);
});