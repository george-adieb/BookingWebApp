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
      start_time,
      end_time,
      places,
      notes,
      // Recurrence (church or abo_talat one_day)
      is_recurring,
      recurrence_type,
      recurrence_count,
      occurrence_dates,
      // Abo Talat specific
      booking_category,
      abo_talat_booking_type,
      check_in_date,
      check_out_date,
      check_out_period,
      facilities,
    } = body;

    // ── Helpers ─────────────────────────────────────────────────────────────
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

    function formatDateAr(dateStr: string): string {
      if (!dateStr) return "—";
      try {
        return new Date(dateStr + "T00:00:00").toLocaleDateString("ar-EG", {
          year: "numeric", month: "long", day: "numeric",
        });
      } catch { return dateStr; }
    }

    const FACILITY_LABELS: Record<string, string> = {
      kitchen:    "مطبخ",
      pool:       "حمام سباحة",
      playground: "ملعب",
    };

    function formatFacilities(facs: string[] | undefined): string {
      if (!Array.isArray(facs) || facs.length === 0) return "لا توجد";
      return facs.map((f) => `• ${FACILITY_LABELS[f] || f}`).join("\n");
    }

    function formatPlaces(ps: { building: string; floor: string; name: string }[] | undefined): string {
      if (!Array.isArray(ps) || ps.length === 0) return "—";
      return ps.map((p) => `• ${p.building} - ${p.floor} - ${p.name}`).join("\n");
    }

    // ── Build email ──────────────────────────────────────────────────────────
    let emailSubject: string;
    let emailBody: string;

    if (booking_category === "abo_talat") {
      // ── Abo Talat email ────────────────────────────────────────────────────
      emailSubject = "طلب حجز بيت أبوتلات جديد - كنيسة مارجرجس سيدي بشر";

      const facText = formatFacilities(facilities);

      if (abo_talat_booking_type === "retreat") {
        const periodAr = check_out_period === "morning" ? "صباحًا" : "مساءً";
        emailBody =
`تم إرسال طلب حجز بيت أبوتلات جديد.

الاسم: ${requester_name || "—"}
الخدمة: ${service_name || "—"}
رقم الهاتف: ${phone || "—"}

نوع الحجز: خلوة
تاريخ الوصول: ${formatDateAr(check_in_date)}
تاريخ المغادرة: ${formatDateAr(check_out_date)}
وقت المغادرة: ${periodAr}

المرافق المطلوبة:
${facText}

الملاحظات: ${notes && notes.trim() ? notes.trim() : "لا توجد ملاحظات"}
`;
      } else {
        // one_day (may be recurring)
        const startFormatted = formatArabic12(start_time);
        const endFormatted   = formatArabic12(end_time);
        const isRec = is_recurring && Array.isArray(occurrence_dates) && occurrence_dates.length > 1;
        const intervalLabel = recurrence_type === "weekly" ? "أسبوعيًا" : "شهريًا";
        const firstDate = isRec ? formatDateAr(occurrence_dates[0]) : formatDateAr(booking_date);
        const lastDate  = isRec ? formatDateAr(occurrence_dates[occurrence_dates.length - 1]) : null;

        const datesText = isRec
          ? occurrence_dates.map((d: string, i: number) => `${i + 1}. ${formatDateAr(d)}`).join("\n")
          : null;

        emailBody = isRec
          ?
`تم إرسال طلب حجز بيت أبوتلات متكرر جديد.

الاسم: ${requester_name || "—"}
الخدمة: ${service_name || "—"}
رقم الهاتف: ${phone || "—"}

نوع الحجز: يوم واحد (متكرر)
التكرار: ${intervalLabel}
عدد المرات: ${recurrence_count || occurrence_dates.length}
من تاريخ: ${firstDate}
إلى تاريخ: ${lastDate}
الوقت: من ${startFormatted} إلى ${endFormatted}

المواعيد:
${datesText}

المرافق المطلوبة:
${facText}

الملاحظات: ${notes && notes.trim() ? notes.trim() : "لا توجد ملاحظات"}
`
          :
`تم إرسال طلب حجز بيت أبوتلات جديد.

الاسم: ${requester_name || "—"}
الخدمة: ${service_name || "—"}
رقم الهاتف: ${phone || "—"}

نوع الحجز: يوم واحد
التاريخ: ${firstDate}
الوقت: من ${startFormatted} إلى ${endFormatted}

المرافق المطلوبة:
${facText}

الملاحظات: ${notes && notes.trim() ? notes.trim() : "لا توجد ملاحظات"}
`;
      }

    } else if (is_recurring && Array.isArray(occurrence_dates) && occurrence_dates.length > 0) {
      // ── Church recurring email (unchanged logic) ──────────────────────────
      const intervalLabel = recurrence_type === "weekly" ? "أسبوعيًا" : "شهريًا";
      const firstDate = formatDateAr(occurrence_dates[0]);
      const lastDate  = formatDateAr(occurrence_dates[occurrence_dates.length - 1]);
      const totalCount = recurrence_count ?? occurrence_dates.length;
      const datesText = occurrence_dates
        .map((d: string, i: number) => `${i + 1}. ${formatDateAr(d)}`)
        .join("\n");
      const startFormatted = formatArabic12(start_time);
      const endFormatted   = formatArabic12(end_time);

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
${formatPlaces(places)}

الملاحظات: ${notes && notes.trim() ? notes.trim() : "لا توجد ملاحظات"}
`;
    } else {
      // ── Church one-time email (original format — unchanged) ───────────────
      const startFormatted = formatArabic12(start_time);
      const endFormatted   = formatArabic12(end_time);

      emailSubject = "طلب حجز جديد - كنيسة مارجرجس سيدي بشر";
      emailBody =
`تم إرسال طلب حجز جديد.

الاسم: ${requester_name || "—"}
الخدمة: ${service_name || "—"}
رقم الهاتف: ${phone || "—"}
التاريخ: ${booking_date || "—"}
الوقت: من ${startFormatted} إلى ${endFormatted}

الأماكن المطلوبة:
${formatPlaces(places)}

الملاحظات: ${notes && notes.trim() ? notes.trim() : "لا توجد ملاحظات"}
`;
    }

    // ── Send via Gmail SMTP ──────────────────────────────────────────────────
    const GMAIL_USER         = Deno.env.get("GMAIL_USER");
    const GMAIL_APP_PASSWORD = Deno.env.get("GMAIL_APP_PASSWORD");

    if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
      console.error("[send-booking-email] SMTP credentials not configured.");
      return new Response(
        JSON.stringify({ ok: false, error: "SMTP credentials not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
    });

    try {
      const info = await transporter.sendMail({
        from: GMAIL_USER, to: ADMIN_EMAIL,
        subject: emailSubject, text: emailBody,
      });
      console.log("[send-booking-email] Email sent:", info.messageId);
      return new Response(
        JSON.stringify({ ok: true, emailId: info.messageId }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (smtpError) {
      console.error("[send-booking-email] SMTP error:", smtpError);
      return new Response(
        JSON.stringify({ ok: false, error: "SMTP error", details: String(smtpError) }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (err) {
    console.error("[send-booking-email] Unexpected error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
