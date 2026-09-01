import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isHighRiskCommand, validateChanges } from "./professional.ts";

Deno.test("visual command mentioning Pix is not high risk", () => {
  const command = "Libere seu acesso com Pix confirmado automaticamente mude essse texti ora asul claro";
  assertEquals(isHighRiskCommand(command), false);
});

Deno.test("atomic find replace becomes a complete validated file change", () => {
  const path = "src/routes/index.tsx";
  const before = '<h1>Libere seu acesso com <span className="text-emerald-400">Pix confirmado automaticamente</span></h1>';
  const changes = validateChanges([
    {
      path,
      find: 'className="text-emerald-400"',
      replace: 'className="text-sky-300"',
    },
  ], [{ path, content: before }], [path]);

  assertEquals(changes.length, 1);
  assertEquals(changes[0].path, path);
  assertEquals(changes[0].create, false);
  assertEquals(changes[0].content.includes('className="text-sky-300"'), true);
});

Deno.test("atomic replacement is rejected when find is ambiguous", () => {
  const path = "src/routes/index.tsx";
  const before = 'const a = "same"; const b = "same";';
  const changes = validateChanges([
    { path, find: "same", replace: "new" },
  ], [{ path, content: before }], [path]);
  assertEquals(changes.length, 0);
});
