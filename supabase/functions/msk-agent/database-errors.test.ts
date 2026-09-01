import { assertEquals } from "jsr:@std/assert@1";
import { mapDatabaseErrorDescriptor } from "./database-errors.ts";

Deno.test("maps RLS violation", () => {
  const error = mapDatabaseErrorDescriptor({ code: "42501", message: "new row violates row-level security policy" });
  assertEquals(error.code, "RLS_VIOLATION");
  assertEquals(error.httpStatus, 403);
});

Deno.test("maps not-null violation", () => {
  const error = mapDatabaseErrorDescriptor({ code: "23502", message: "null value violates not-null constraint" });
  assertEquals(error.code, "NOT_NULL_VIOLATION");
  assertEquals(error.httpStatus, 422);
});

Deno.test("maps missing table", () => {
  const error = mapDatabaseErrorDescriptor({ code: "42P01", message: "relation msk_tasks does not exist" });
  assertEquals(error.code, "TABLE_NOT_FOUND");
});

Deno.test("maps PostgREST schema mismatch", () => {
  const error = mapDatabaseErrorDescriptor({ code: "PGRST204", message: "column not found in schema cache" });
  assertEquals(error.code, "DATABASE_SCHEMA_MISMATCH");
});

Deno.test("maps foreign-key violation", () => {
  const error = mapDatabaseErrorDescriptor({ code: "23503", message: "violates foreign key constraint" });
  assertEquals(error.code, "FOREIGN_KEY_VIOLATION");
});

Deno.test("maps transient database failures as retryable", () => {
  const error = mapDatabaseErrorDescriptor({ code: "40001", message: "serialization failure" });
  assertEquals(error.code, "DATABASE_TEMPORARILY_UNAVAILABLE");
  assertEquals(error.retryable, true);
});
