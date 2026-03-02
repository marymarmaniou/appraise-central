import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const payload = await req.json();

    // Tally webhook payload structure
    const data = payload.data || payload;
    const fields = data.fields || [];
    const submissionId = data.submissionId || data.responseId || crypto.randomUUID();

    // Extract applicant name from fields
    let applicantName = "Unnamed";
    const applicantFields: { label: string; type: string; value: string; fileType?: string }[] = [];

    for (const field of fields) {
      const label = field.label || field.key || "";
      const value = field.value ?? "";

      // Tally sends file uploads as arrays of objects with url property
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item?.url) {
            const fileType = detectFileType(item.url);
            applicantFields.push({
              label: item.name || label,
              type: "file",
              value: item.url,
              fileType,
            });
          }
        }
        continue;
      }

      const strValue = String(value);

      // Detect name field
      if (
        label.toLowerCase().includes("full name") ||
        label.toLowerCase() === "name"
      ) {
        applicantName = strValue;
      }

      // Skip internal Tally fields
      if (
        label.toLowerCase().includes("submission id") ||
        label.toLowerCase().includes("respondent id")
      ) {
        continue;
      }

      // Detect file URLs
      const ft = detectFileType(strValue);
      if (ft !== "text") {
        applicantFields.push({
          label,
          type: "file",
          value: strValue,
          fileType: ft,
        });
      } else if (strValue.trim()) {
        applicantFields.push({
          label,
          type: "text",
          value: strValue,
        });
      }
    }

    const { error } = await supabase.from("webhook_applicants").upsert(
      {
        submission_id: submissionId,
        applicant_name: applicantName,
        submitted_at: data.submittedAt || new Date().toISOString(),
        fields: applicantFields,
        imported: false,
      },
      { onConflict: "submission_id" }
    );

    if (error) {
      console.error("Insert error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send email notification via Resend API
    try {
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (resendApiKey) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            from: "notifications@yourdomain.com", // Update with your verified domain
            to: "admin@yourdomain.com", // Update with your notification email
            subject: `New 2048 Award Application: ${applicantName}`,
            html: `
              <h2>New Application Received</h2>
              <p>A new application was just submitted by <strong>${applicantName}</strong> for the 2048 Award.</p>
              <p>Log in to Appraise Central to view the full details.</p>
            `
          })
        });
      }
    } catch (emailErr) {
      console.error("Failed to send email notification:", emailErr);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function detectFileType(url: string): string {
  if (!url || typeof url !== "string") return "text";
  const lower = url.toLowerCase();
  const pathOnly = lower.split("?")[0];
  if (lower.includes("youtube.com") || lower.includes("youtu.be")) return "youtube";
  if (lower.includes("vimeo.com")) return "vimeo";
  if (pathOnly.match(/\.(pdf)$/)) return "pdf";
  if (pathOnly.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) return "image";
  if (pathOnly.match(/\.(mp4|webm|mov|wav|mp3|m4a)$/)) return "video";
  if (pathOnly.match(/\.(xlsx|xls|csv)$/)) return "excel";
  if (pathOnly.match(/\.(docx|doc)$/)) return "word";
  if (lower.startsWith("http")) return "unknown";
  return "text";
}
