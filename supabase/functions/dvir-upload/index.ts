// supabase/functions/dvir-upload/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "dvir-captures";
const RETENTION_DAYS = 7;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey" },
    });
  }
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const truckId = formData.get("truck_id") as string | null;
    const companyId = formData.get("company_id") as string | null;
    const driverId = formData.get("driver_id") as string | null;
    const inspectionPoint = formData.get("inspection_point") as string | null;
    const status = (formData.get("status") as string) || "ok";
    const notes = formData.get("notes") as string | null;

    if (!file || !truckId || !companyId) {
      return new Response(JSON.stringify({ error: "file, truck_id, and company_id are required" }), { status: 400 });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const ext = file.name?.split(".").pop() || "jpg";
    const storagePath = `${companyId}/${truckId}/${timestamp}.${ext}`;

    const fileBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, fileBuffer, { contentType: file.type || "image/jpeg", upsert: false });
    if (uploadError) return new Response(JSON.stringify({ error: "Upload failed", details: uploadError.message }), { status: 500 });

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    const publicUrl = urlData.publicUrl;
    const now = new Date();
    const deleteAt = new Date(now.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000);

    const { data: record, error: dbError } = await supabase.from("dvir_photos").insert({
      company_id: companyId, truck_id: truckId, driver_id: driverId, inspection_point: inspectionPoint,
      status, notes, storage_path: storagePath, url: publicUrl, is_protected: false,
      captured_at: now.toISOString(), delete_at: deleteAt.toISOString(),
    }).select().single();

    if (dbError) {
      await supabase.storage.from(BUCKET).remove([storagePath]);
      return new Response(JSON.stringify({ error: "Database insert failed", details: dbError.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true, photo: record }), {
      status: 201, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal error", details: (err as Error).message }), { status: 500 });
  }
});
