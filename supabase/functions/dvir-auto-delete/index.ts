// supabase/functions/dvir-auto-delete/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "dvir-captures";
const BATCH_SIZE = 100;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey" },
    });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const now = new Date().toISOString();
    let totalDeleted = 0;
    let totalErrors = 0;
    let hasMore = true;

    while (hasMore) {
      const { data: expiredPhotos, error: queryError } = await supabase
        .from("dvir_photos").select("id, storage_path").eq("is_protected", false).lt("delete_at", now).limit(BATCH_SIZE);

      if (queryError) return new Response(JSON.stringify({ error: "Query failed", details: queryError.message }), { status: 500 });
      if (!expiredPhotos || expiredPhotos.length === 0) { hasMore = false; break; }

      const storagePaths = expiredPhotos.map(p => p.storage_path).filter(Boolean) as string[];
      const recordIds = expiredPhotos.map(p => p.id);

      if (storagePaths.length > 0) {
        const { error: storageError } = await supabase.storage.from(BUCKET).remove(storagePaths);
        if (storageError) { console.error("Storage delete error:", storageError.message); totalErrors += storagePaths.length; }
      }

      const { error: deleteError } = await supabase.from("dvir_photos").delete().in("id", recordIds);
      if (deleteError) { console.error("DB delete error:", deleteError.message); totalErrors += recordIds.length; }
      else { totalDeleted += recordIds.length; }

      if (expiredPhotos.length < BATCH_SIZE) hasMore = false;
    }

    const summary = { success: true, deleted: totalDeleted, errors: totalErrors, timestamp: now };
    console.log("DVIR auto-delete complete:", JSON.stringify(summary));
    return new Response(JSON.stringify(summary), {
      status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal error", details: (err as Error).message }), { status: 500 });
  }
});
