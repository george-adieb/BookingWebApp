// Supabase Edge Function: send-booking-email
// Sends an Arabic email to the admin when a new booking request is submitted.
// Uses Gmail SMTP via nodemailer.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import nodemailer from "npm:nodemailer@6.9.13";

const ADMIN_EMAIL = "antounyacob144@gmail.com";

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
      start_time,        // "HH:mm" 24-hour
      end_time,          // "HH:mm" 24-hour
      places,            // Array of { building, floor, name }
      notes,
      // Recurrence fields (optional — absent for one-time bookings)
      is_recurring,      // boolean
      recurrence_type,   // 'weekly' | 'monthly'
      recurrence_count,  // total number of occurrences
      occurrence_dates,  // Array<string> — all YYYY-MM-DD dates
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
      else if (h === 12) { hour12 = 12; period = "مساءً";  }
      else               { hour12 = h - 12; period = "مساءً"; }

      return `${String(hour12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
    }

    // ── Arabic date formatter ───────────────────────────────────────────────
    function formatDateAr(dateStr: string): string {
      if (!dateStr) return "—";
      try {
        return new Date(dateStr + "T00:00:00").toLocaleDateString("ar-EG", {
          year: "numeric", month: "long", day: "numeric",
        });
      } catch { return dateStr; }
    }

    // ── Format places list ──────────────────────────────────────────────────
    const placesText = Array.isArray(places) && places.length > 0
      ? places.map((p: { building: string; floor: string; name: string }) =>
          `• ${p.building} - ${p.floor} - ${p.name}`
        ).join("\n")
      : "—";

    const startFormatted = formatArabic12(start_time);
    const endFormatted   = formatArabic12(end_time);

    // ── Build email body ────────────────────────────────────────────────────
    let emailBody: string;
    let emailSubject: string;

    if (is_recurring && Array.isArray(occurrence_dates) && occurrence_dates.length > 0) {
      // ── Recurring booking email ─────────────────────────────────────────
      const intervalLabel = recurrence_type === "weekly" ? "أسبوعيًا" : "شهريًا";
      const firstDate = formatDateAr(occurrence_dates[0]);
      const lastDate  = formatDateAr(occurrence_dates[occurrence_dates.length - 1]);
      const totalCount = recurrence_count ?? occurrence_dates.length;

      const datesText = occurrence_dates
        .map((d: string, i: number) => `${i + 1}. ${formatDateAr(d)}`)
        .join("\n");

      emailSubject = "طلب حجز متكرر جديد - كنيسة مارجرجس سيدي بشر";

      emailBody =
`تم إرسال طلب حجز متكرر جديد.

الاسم: ${requester_name || "—"}
الخدمة: ${service_name || "—"}
رقم الهاتف: ${phone || "—"}

نوع الحجز: حجز متكرر
التكرار: ${intervalLabel}
عدد المرات: ${totalCount}
من تاريخ: ${firstDate}
إلى تاريخ: ${lastDate}
الوقت: من ${startFormatted} إلى ${endFormatted}

المواعيد:
${datesText}

الأماكن المطلوبة:
${placesText}

الملاحظات: ${notes && notes.trim() ? notes.trim() : "لا توجد ملاحظات"}
`;
    } else {
      // ── One-time booking email (unchanged format) ───────────────────────
      emailSubject = "طلب حجز جديد - كنيسة مارجرجس سيدي بشر";

      emailBody =
`تم إرسال طلب حجز جديد.

الاسم: ${requester_name || "—"}
الخدمة: ${service_name || "—"}
رقم الهاتف: ${phone || "—"}
التاريخ: ${booking_date || "—"}
الوقت: من ${startFormatted} إلى ${endFormatted}

الأماكن المطلوبة:
${placesText}

الملاحظات: ${notes && notes.trim() ? notes.trim() : "لا توجد ملاحظات"}
`;
    }

    // ── Send via Gmail SMTP ──────────────────────────────────────────────────
    const GMAIL_USER         = Deno.env.get("GMAIL_USER");
    const GMAIL_APP_PASSWORD = Deno.env.get("GMAIL_APP_PASSWORD");

    if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
      console.error("[send-booking-email] GMAIL_USER or GMAIL_APP_PASSWORD secret is not set.");
      return new Response(
        JSON.stringify({ ok: false, error: "SMTP credentials not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD,
      },
    });

    try {
      const info = await transporter.sendMail({
        from:    GMAIL_USER,
        to:      ADMIN_EMAIL,
        subject: emailSubject,
        text:    emailBody,
      });

      console.log("[send-booking-email] Email sent successfully:", info.messageId);

      return new Response(
        JSON.stringify({ ok: true, emailId: info.messageId }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (smtpError) {
      console.error("[send-booking-email] SMTP error:", smtpError);
      // Still return 200 — booking already succeeded, email failure is non-critical
      return new Response(
        JSON.stringify({ ok: false, error: "SMTP error", details: String(smtpError) }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (err) {
    console.error("[send-booking-email] Unexpected error:", err);
    // Return 200 to avoid blocking the booking flow
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
