// supabase/functions/dvir-defect-alert/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey" },
    });
  }
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();
    const { photo_id, company_id, truck_id, driver_name, inspection_point, notes, photo_url } = body;

    if (!company_id || !truck_id) return new Response(JSON.stringify({ error: "company_id and truck_id are required" }), { status: 400 });

    const { data: company, error: companyError } = await supabase.from("companies").select("name, shop_alert_email").eq("id", company_id).single();
    if (companyError || !company) return new Response(JSON.stringify({ error: "Company not found" }), { status: 404 });

    const shopEmail = company.shop_alert_email;
    if (!shopEmail) return new Response(JSON.stringify({ error: "No shop alert email configured" }), { status: 422 });

    if (photo_id) await supabase.from("dvir_photos").update({ is_protected: true, status: "defective" }).eq("id", photo_id);

    const subject = `DVIR Defect Alert - Truck ${truck_id}`;
    const htmlBody = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><div style="background:#dc2626;color:white;padding:16px 24px;border-radius:8px 8px 0 0"><h2 style="margin:0">DVIR Defect Alert</h2></div><div style="background:#f8fafc;padding:24px;border:1px solid #e2e8f0;border-radius:0 0 8px 8px"><table style="width:100%;border-collapse:collapse"><tr><td style="padding:8px 0;font-weight:bold;color:#475569">Company:</td><td style="padding:8px 0;color:#1e293b">${company.name}</td></tr><tr><td style="padding:8px 0;font-weight:bold;color:#475569">Truck ID:</td><td style="padding:8px 0;color:#1e293b;font-size:18px;font-weight:bold">${truck_id}</td></tr>${driver_name?`<tr><td style="padding:8px 0;font-weight:bold;color:#475569">Driver:</td><td style="padding:8px 0;color:#1e293b">${driver_name}</td></tr>`:``}${inspection_point?`<tr><td style="padding:8px 0;font-weight:bold;color:#475569">Inspection Point:</td><td style="padding:8px 0;color:#1e293b">${inspection_point}</td></tr>`:``}${notes?`<tr><td style="padding:8px 0;font-weight:bold;color:#475569">Notes:</td><td style="padding:8px 0;color:#1e293b">${notes}</td></tr>`:``}</table>${photo_url?`<div style="margin-top:16px"><p style="font-weight:bold;color:#475569;margin-bottom:8px">Defect Photo:</p><img src="${photo_url}" alt="Defect" style="max-width:100%;border-radius:8px;border:2px solid #dc2626"/></div>`:``}<div style="margin-top:24px;padding:12px;background:#fef2f2;border-radius:6px;border-left:4px solid #dc2626"><p style="margin:0;color:#991b1b;font-size:14px"><strong>Action Required:</strong> Review this defect and schedule maintenance. This photo is protected from auto-deletion.</p></div></div></div>`;

    if (RESEND_API_KEY) {
      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: "HaulFlow DVIR <alerts@haulflow.app>", to: [shopEmail], subject, html: htmlBody }),
      });
      if (!emailRes.ok) {
        const errBody = await emailRes.text();
        return new Response(JSON.stringify({ error: "Email send failed", details: errBody }), { status: 502 });
      }
    } else {
      console.log("RESEND_API_KEY not set. Would email:", shopEmail, "Subject:", subject);
    }

    return new Response(JSON.stringify({ success: true, message: `Defect alert sent to ${shopEmail}`, truck_id }), {
      status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal error", details: (err as Error).message }), { status: 500 });
  }
});
