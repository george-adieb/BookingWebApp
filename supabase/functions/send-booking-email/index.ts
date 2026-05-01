// Supabase Edge Function: send-booking-email
// Sends an Arabic email to the admin when a new booking request is submitted.
// Uses Resend (https://resend.com) — API key stored as a Supabase secret.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ADMIN_EMAIL = "Adib.george1212@gmail.com";
const FROM_EMAIL  = "onboarding@resend.dev"; // use your verified domain once set up

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    const {
      requester_name,
      service_name,
      phone,
      booking_date,
      start_time,       // "HH:mm" 24-hour
      end_time,         // "HH:mm" 24-hour
      places,           // Array of { building, floor, name }
      notes,
    } = body;

    // ── Arabic 12-hour formatter ────────────────────────────────────────────
    function formatArabic12(hhmm: string): string {
      if (!hhmm || typeof hhmm !== "string") return hhmm || "—";
      const match = hhmm.match(/^(\d{1,2}):(\d{2})$/);
      if (!match) return hhmm;
      const h = parseInt(match[1], 10);
      const m = parseInt(match[2], 10);

      let hour12: number;
      let period: string;
      if (h === 0)       { hour12 = 12; period = "صباحًا"; }
      else if (h < 12)   { hour12 = h;  period = "صباحًا"; }
      else if (h === 12) { hour12 = 12; period = "مساءً"; }
      else               { hour12 = h - 12; period = "مساءً"; }

      return `${String(hour12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
    }

    // ── Format places list ──────────────────────────────────────────────────
    const placesText = Array.isArray(places) && places.length > 0
      ? places.map((p: { building: string; floor: string; name: string }) =>
          `• ${p.building} - ${p.floor} - ${p.name}`
        ).join("\n")
      : "—";

    // ── Build email body (plain text, Arabic) ───────────────────────────────
    const startFormatted = formatArabic12(start_time);
    const endFormatted   = formatArabic12(end_time);

    const emailBody = `تم إرسال طلب حجز جديد.

الاسم: ${requester_name || "—"}
الخدمة: ${service_name || "—"}
رقم الهاتف: ${phone || "—"}
التاريخ: ${booking_date || "—"}
الوقت: من ${startFormatted} إلى ${endFormatted}

الأماكن المطلوبة:
${placesText}

الملاحظات: ${notes && notes.trim() ? notes.trim() : "لا توجد ملاحظات"}
`;

    // ── Send via Resend ─────────────────────────────────────────────────────
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    if (!RESEND_API_KEY) {
      console.error("[send-booking-email] RESEND_API_KEY secret is not set.");
      // Return 200 so the booking is NOT failed on the client
      return new Response(
        JSON.stringify({ ok: false, error: "RESEND_API_KEY not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to:   [ADMIN_EMAIL],
        subject: "طلب حجز جديد - كنيسة مارجرجس سيدي بشر",
        text: emailBody,
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.error("[send-booking-email] Resend API error:", resendRes.status, errText);
      // Still return 200 — booking already succeeded, email failure is non-critical
      return new Response(
        JSON.stringify({ ok: false, error: "Resend API error", details: errText }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resendData = await resendRes.json();
    console.log("[send-booking-email] Email sent successfully:", resendData.id);

    return new Response(
      JSON.stringify({ ok: true, emailId: resendData.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[send-booking-email] Unexpected error:", err);
    // Return 200 to avoid blocking the booking flow
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
