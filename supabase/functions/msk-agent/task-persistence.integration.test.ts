import { assertEquals } from "jsr:@std/assert@1";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL") || "";
const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const projectId = Deno.env.get("MSK_TEST_PROJECT_ID") || "";
const userId = Deno.env.get("MSK_TEST_USER_ID") || "";

Deno.test({
  name: "msk_tasks persistence probe inserts and rolls back safely",
  ignore: !url || !serviceRole || !projectId || !userId,
  fn: async () => {
    const db = createClient(url, serviceRole);
    const { data, error } = await db.rpc("msk_task_persistence_probe", {
      p_project_id: projectId,
      p_user_id: userId,
    });
    if (error) throw error;
    assertEquals(data?.ok, true);
    assertEquals(data?.code, "DATABASE_WRITE_READY");

    const { count, error: countError } = await db
      .from("msk_tasks")
      .select("id", { head: true, count: "exact" })
      .eq("command", "__MSK_PERSISTENCE_PROBE__");
    if (countError) throw countError;
    assertEquals(count, 0);
  },
});
