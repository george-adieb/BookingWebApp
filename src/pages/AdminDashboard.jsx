import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import StatusBadge from '../components/StatusBadge';
import { formatArabic12 } from '../components/ArabicTimePicker';
import {
  LogOut, Filter, Check, X, Calendar, MapPin, Clock, Phone,
  User, LayoutDashboard, Search, Loader2, AlertCircle,
  FileText, StickyNote, List, Inbox, RefreshCw, Building2,
  UtensilsCrossed, Waves, Dumbbell, XCircle, Trash2,
} from 'lucide-react';
import AdminBookingCalendar from '../components/AdminBookingCalendar';

const FACILITY_LABELS = {
  kitchen:    'مطبخ',
  pool:       'حمام سباحة',
  playground: 'ملعب',
};

const FACILITY_ICONS = {
  kitchen:    UtensilsCrossed,
  pool:       Waves,
  playground: Dumbbell,
};

const formatPlace = (p) => p ? `${p.building} - ${p.floor} - ${p.name}` : '—';

function normalizePhone(phone) {
  let cleaned = phone.replace(/[\s\-]/g, '').replace(/[^\d+]/g, '');
  if (cleaned.startsWith('0')) cleaned = '+20' + cleaned.slice(1);
  return cleaned;
}

// ── Arabic date label ─────────────────────────────────────────────────────────
function formatDateAr(dateStr) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('ar-EG', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch { return dateStr; }
}

// ── Derive first/last dates for a recurring group from a single booking row ───
function deriveRecurringDates(booking) {
  if (!booking.recurrence_group_id) return { firstDate: null, lastDate: null };
  const base = booking.booking_date;
  const total = booking.total_occurrences || 1;
  const occNum = booking.occurrence_number || 1;
  const interval = booking.recurrence_type; // 'weekly' | 'monthly'

  // Calculate first occurrence date
  function shiftDate(dateStr, steps) {
    const d = new Date(dateStr + 'T00:00:00');
    if (interval === 'weekly') {
      d.setDate(d.getDate() + 7 * steps);
    } else {
      const targetMonth = d.getMonth() + steps;
      const year = d.getFullYear() + Math.floor(targetMonth / 12);
      const month = ((targetMonth % 12) + 12) % 12;
      const day = d.getDate();
      const lastDay = new Date(year, month + 1, 0).getDate();
      d.setFullYear(year, month, Math.min(day, lastDay));
    }
    return d.toISOString().split('T')[0];
  }

  const firstDate = shiftDate(base, -(occNum - 1));
  const lastDate  = shiftDate(firstDate, total - 1);
  return { firstDate, lastDate };
}

// ── WhatsApp message builder ──────────────────────────────────────────────────
function buildFacilitiesBlock(facilities) {
  if (!Array.isArray(facilities) || facilities.length === 0) return '';
  return '\nالمرافق:\n' + facilities.map((f) => `- ${FACILITY_LABELS[f] || f}`).join('\n');
}

function buildWaMessage(booking) {
  // ── Abo Talat messages ──────────────────────────────────────────────────
  if (booking.booking_category === 'abo_talat') {
    const startAr = formatArabic12(booking.start_time);
    const endAr   = formatArabic12(booking.end_time);
    const facBlock = buildFacilitiesBlock(booking.facilities);
    const periodAr = booking.check_out_period === 'morning' ? 'صباحًا' : 'مساءً';

    if (booking.abo_talat_booking_type === 'one_day') {
      if (booking.status === 'approved') {
        return encodeURIComponent(
          `مرحبًا، تم تأكيد حجز بيت أبوتلات في كنيسة مارجرجس سيدي بشر.\n\n` +
          `تفاصيل الحجز:\n` +
          `نوع الحجز: يوم واحد\n` +
          `التاريخ: ${booking.booking_date}\n` +
          `الوقت: من ${startAr} إلى ${endAr}` +
          `${facBlock}\n\n` +
          `ربنا يبارك خدمتك.`
        );
      }
      if (booking.status === 'rejected') {
        return encodeURIComponent(
          `مرحبًا، نعتذر لعدم إمكانية تأكيد حجز بيت أبوتلات.\n\n` +
          `تفاصيل الطلب:\n` +
          `نوع الحجز: يوم واحد\n` +
          `التاريخ: ${booking.booking_date}\n` +
          `الوقت: من ${startAr} إلى ${endAr}` +
          `${facBlock}\n\n` +
          `برجاء التواصل مع المسؤول لمعرفة التفاصيل.`
        );
      }
    }

    if (booking.abo_talat_booking_type === 'retreat') {
      if (booking.status === 'approved') {
        return encodeURIComponent(
          `مرحبًا، تم تأكيد حجز خلوة بيت أبوتلات في كنيسة مارجرجس سيدي بشر.\n\n` +
          `تفاصيل الحجز:\n` +
          `نوع الحجز: خلوة\n` +
          `تاريخ الوصول: ${booking.check_in_date}\n` +
          `تاريخ المغادرة: ${booking.check_out_date}\n` +
          `وقت المغادرة: ${periodAr}` +
          `${facBlock}\n\n` +
          `ربنا يبارك خدمتك.`
        );
      }
      if (booking.status === 'rejected') {
        return encodeURIComponent(
          `مرحبًا، نعتذر لعدم إمكانية تأكيد حجز خلوة بيت أبوتلات.\n\n` +
          `تفاصيل الطلب:\n` +
          `نوع الحجز: خلوة\n` +
          `تاريخ الوصول: ${booking.check_in_date}\n` +
          `تاريخ المغادرة: ${booking.check_out_date}\n` +
          `وقت المغادرة: ${periodAr}` +
          `${facBlock}\n\n` +
          `برجاء التواصل مع المسؤول لمعرفة التفاصيل.`
        );
      }
    }
    return null;
  }

// ── Church place messages (original) ────────────────────────────────────────
  const placeLines = booking.places?.length
    ? booking.places.map((p) => `- ${formatPlace(p)}`).join('\n')
    : null;
  const placesBlock = placeLines
    ? `الأماكن:\n${placeLines}`
    : 'الأماكن: لم يتم تحديد أماكن';

  const startAr = formatArabic12(booking.start_time);
  const endAr   = formatArabic12(booking.end_time);

  const isRecurring = !!booking.recurrence_group_id;

  if (!isRecurring) {
    // ── One-time (unchanged) ────────────────────────────────────────────────
    if (booking.status === 'approved') {
      return encodeURIComponent(
        `مرحبًا، تم تأكيد حجزك في كنيسة مارجرجس سيدي بشر.\n\n` +
        `تفاصيل الحجز:\n` +
        `التاريخ: ${booking.booking_date}\n` +
        `الوقت: من ${startAr} إلى ${endAr}\n` +
        `${placesBlock}\n\n` +
        `ربنا يبارك خدمتك.`
      );
    }
    if (booking.status === 'rejected') {
      return encodeURIComponent(
        `مرحبًا، نعتذر لعدم إمكانية تأكيد حجزك في كنيسة مارجرجس سيدي بشر.\n\n` +
        `تفاصيل الطلب:\n` +
        `التاريخ: ${booking.booking_date}\n` +
        `الوقت: من ${startAr} إلى ${endAr}\n` +
        `${placesBlock}\n\n` +
        `برجاء التواصل مع المسؤول لمعرفة التفاصيل.`
      );
    }
    return null;
  }

  // ── Recurring ─────────────────────────────────────────────────────────────
  const intervalLabel = booking.recurrence_type === 'weekly' ? 'أسبوعيًا' : 'شهريًا';
  const { firstDate, lastDate } = deriveRecurringDates(booking);
  const count = booking.total_occurrences || '—';

  if (booking.status === 'approved') {
    return encodeURIComponent(
      `مرحبًا، تم تأكيد حجزك المتكرر في كنيسة مارجرجس سيدي بشر.\n\n` +
      `تفاصيل الحجز:\n` +
      `نوع الحجز: حجز متكرر\n` +
      `التكرار: ${intervalLabel}\n` +
      `عدد المرات: ${count}\n` +
      `من تاريخ: ${firstDate || '—'}\n` +
      `إلى تاريخ: ${lastDate || '—'}\n` +
      `الوقت: من ${startAr} إلى ${endAr}\n\n` +
      `${placesBlock}\n\n` +
      `ربنا يبارك خدمتك.`
    );
  }
  if (booking.status === 'rejected') {
    return encodeURIComponent(
      `مرحبًا، نعتذر لعدم إمكانية تأكيد حجزك المتكرر في كنيسة مارجرجس سيدي بشر.\n\n` +
      `تفاصيل الطلب:\n` +
      `نوع الحجز: حجز متكرر\n` +
      `التكرار: ${intervalLabel}\n` +
      `عدد المرات: ${count}\n` +
      `من تاريخ: ${firstDate || '—'}\n` +
      `إلى تاريخ: ${lastDate || '—'}\n` +
      `الوقت: من ${startAr} إلى ${endAr}\n\n` +
      `${placesBlock}\n\n` +
      `برجاء التواصل مع المسؤول لمعرفة التفاصيل.`
    );
  }
  return null;
}

function WhatsAppLink({ booking }) {
  if (!booking.phone) return null;
  const phone   = normalizePhone(booking.phone);
  const message = buildWaMessage(booking);
  const url     = message ? `https://wa.me/${phone}?text=${message}` : `https://wa.me/${phone}`;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" title="تواصل عبر واتساب"
      className="inline-flex items-center justify-center w-5 h-5 text-[#25D366] hover:scale-110 transition-transform flex-shrink-0">
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.855L.057 23.526a.75.75 0 0 0 .917.917l5.671-1.475A11.953 11.953 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.713 9.713 0 0 1-4.953-1.354l-.355-.21-3.667.954.975-3.562-.23-.366A9.712 9.712 0 0 1 2.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z"/>
      </svg>
    </a>
  );
}

function StatCard({ icon, colorKey, label, value }) {
  const cls = {
    yellow: ['border-yellow-100', 'bg-yellow-50 text-yellow-600'],
    green:  ['border-green-100',  'bg-green-50 text-green-600'],
    red:    ['border-red-100',    'bg-red-50 text-red-600'],
  }[colorKey];
  return (
    <div className={`bg-white p-4 sm:p-6 rounded-2xl shadow-sm border ${cls[0]} flex items-center gap-3 sm:gap-4`}>
      <div className={`w-11 h-11 sm:w-14 sm:h-14 rounded-full flex items-center justify-center flex-shrink-0 ${cls[1]}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs sm:text-sm font-semibold text-gray-500 leading-tight">{label}</p>
        <p className="text-2xl sm:text-3xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, icon, children }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-colors ${active ? 'bg-[#8B0000] text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
      {icon}{children}
    </button>
  );
}

// ── Reject Modal — supports scope selection for recurring bookings ─────────────
function RejectModal({ booking, onConfirm, onCancel, loading }) {
  const [reason, setReason] = useState('');
  const [scope, setScope]   = useState('single'); // 'single' | 'all'
  const isRecurring = !!booking?.recurrence_group_id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-5 space-y-4" dir="rtl">
        <h3 className="text-lg font-bold text-gray-900">سبب الرفض</h3>
        <p className="text-sm text-gray-500">يمكنك كتابة سبب الرفض أو ترك الحقل فارغاً</p>
        <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} disabled={loading}
          placeholder="سبب الرفض (اختياري)..."
          className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#8B0000] outline-none resize-none" />

        {isRecurring && (
          <div className="space-y-2">
            <p className="text-sm font-bold text-gray-700">تطبيق على:</p>
            <div className="space-y-2">
              <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${scope === 'single' ? 'border-[#8B0000] bg-red-50' : 'border-gray-200'}`}>
                <input type="radio" name="rejectScope" value="single"
                  checked={scope === 'single'} onChange={() => setScope('single')}
                  className="w-4 h-4 text-[#8B0000] focus:ring-[#8B0000]" />
                <span className="text-sm font-semibold text-gray-800">هذا الحجز فقط</span>
              </label>
              <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${scope === 'all' ? 'border-[#8B0000] bg-red-50' : 'border-gray-200'}`}>
                <input type="radio" name="rejectScope" value="all"
                  checked={scope === 'all'} onChange={() => setScope('all')}
                  className="w-4 h-4 text-[#8B0000] focus:ring-[#8B0000]" />
                <span className="text-sm font-semibold text-gray-800">كل الحجوزات المتكررة المرتبطة</span>
              </label>
            </div>
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} disabled={loading}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold text-sm">إلغاء</button>
          <button onClick={() => onConfirm(reason, scope)} disabled={loading}
            className="px-5 py-2 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 flex items-center gap-2 disabled:opacity-70 text-sm">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}تأكيد الرفض
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Approve scope modal for recurring bookings ────────────────────────────────
function ApproveScopeModal({ booking, onConfirm, onCancel, loading, scopeError }) {
  const [scope, setScope] = useState('single');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-5 space-y-4" dir="rtl">
        <h3 className="text-lg font-bold text-gray-900">الموافقة على الحجز المتكرر</h3>
        <div className="space-y-2">
          <p className="text-sm font-bold text-gray-700">تطبيق الموافقة على:</p>
          <div className="space-y-2">
            <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${scope === 'single' ? 'border-green-600 bg-green-50' : 'border-gray-200'}`}>
              <input type="radio" name="approveScope" value="single"
                checked={scope === 'single'} onChange={() => setScope('single')}
                className="w-4 h-4 text-green-600 focus:ring-green-600" />
              <span className="text-sm font-semibold text-gray-800">هذا الحجز فقط</span>
            </label>
            <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${scope === 'all' ? 'border-green-600 bg-green-50' : 'border-gray-200'}`}>
              <input type="radio" name="approveScope" value="all"
                checked={scope === 'all'} onChange={() => setScope('all')}
                className="w-4 h-4 text-green-600 focus:ring-green-600" />
              <div>
                <span className="text-sm font-semibold text-gray-800">كل الحجوزات المتكررة المرتبطة</span>
                <p className="text-xs text-gray-500 mt-0.5">سيتم التحقق من توفر جميع المواعيد قبل الموافقة</p>
              </div>
            </label>
          </div>
        </div>

        {scopeError && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm font-semibold">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{scopeError}
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} disabled={loading}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold text-sm">إلغاء</button>
          <button onClick={() => onConfirm(scope)} disabled={loading}
            className="px-5 py-2 rounded-lg bg-green-600 text-white font-bold hover:bg-green-700 flex items-center gap-2 disabled:opacity-70 text-sm">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            <Check className="w-4 h-4" />موافقة
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete modal — supports scope selection for recurring bookings ─────────────
function DeleteModal({ booking, onConfirm, onCancel, loading }) {
  const [scope, setScope] = useState('single'); // 'single' | 'all'
  const isRecurring = !!booking?.recurrence_group_id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-200" dir="rtl">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 text-red-600">
          <Trash2 className="w-5 h-5" />
          {isRecurring ? 'حذف الحجز المتكرر' : 'حذف الطلب'}
        </h3>
        <div className="text-sm text-gray-600 space-y-1">
          <p className="font-bold">هل أنت متأكد من حذف هذا الطلب؟</p>
          <p className="text-xs text-red-500 font-semibold">سيتم حذف الطلب نهائيًا ولا يمكن التراجع عن هذا الإجراء.</p>
        </div>

        {isRecurring && (
          <div className="space-y-2 pt-2 border-t border-gray-100">
            <p className="text-xs font-bold text-gray-500">تطبيق الحذف على:</p>
            <div className="space-y-2">
              <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${scope === 'single' ? 'border-red-600 bg-red-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                <input type="radio" name="deleteScope" value="single"
                  checked={scope === 'single'} onChange={() => setScope('single')}
                  className="w-4 h-4 text-red-600 focus:ring-red-600" />
                <span className="text-sm font-semibold text-gray-800">حذف هذا الطلب فقط</span>
              </label>
              <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${scope === 'all' ? 'border-red-600 bg-red-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                <input type="radio" name="deleteScope" value="all"
                  checked={scope === 'all'} onChange={() => setScope('all')}
                  className="w-4 h-4 text-red-600 focus:ring-red-600" />
                <span className="text-sm font-semibold text-gray-800">حذف كل الحجوزات المتكررة المرتبطة</span>
              </label>
            </div>
          </div>
        )}

        <div className="flex gap-3 justify-end pt-2">
          <button onClick={onCancel} disabled={loading}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold text-sm cursor-pointer transition-colors">إلغاء</button>
          <button onClick={() => onConfirm(scope)} disabled={loading}
            className="px-5 py-2 rounded-lg bg-red-650 text-white font-bold hover:bg-red-700 flex items-center gap-2 disabled:opacity-70 text-sm cursor-pointer transition-colors">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            نعم، حذف الطلب
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Abo Talat details block (shown inside BookingCard) ───────────────────────
function AboTalatDetails({ booking }) {
  const isRetreat = booking.abo_talat_booking_type === 'retreat';
  const periodAr  = booking.check_out_period === 'morning' ? 'صباحًا' : 'مساءً';

  return (
    <div className="space-y-2">
      {/* Badge */}
      <span className="inline-flex items-center gap-1.5 bg-orange-100 text-orange-700 border border-orange-200 rounded-full px-2.5 py-0.5 text-xs font-bold">
        <Building2 className="w-3 h-3" />بيت أبوتلات
      </span>

      {/* Type + dates */}
      <div className="bg-orange-50 border border-orange-100 rounded-lg px-3 py-2 text-xs text-orange-900 space-y-1">
        <p><span className="font-bold">نوع الحجز:</span> {isRetreat ? 'خلوة' : 'يوم واحد'}</p>
        {isRetreat ? (
          <>
            <p><span className="font-bold">تاريخ الوصول:</span> {formatDateAr(booking.check_in_date)}</p>
            <p><span className="font-bold">تاريخ المغادرة:</span> {formatDateAr(booking.check_out_date)}</p>
            <p><span className="font-bold">وقت المغادرة:</span> {periodAr}</p>
          </>
        ) : (
          <>
            <p><span className="font-bold">التاريخ:</span> {formatDateAr(booking.booking_date)}</p>
            <p><span className="font-bold">الوقت:</span> {formatArabic12(booking.start_time)} — {formatArabic12(booking.end_time)}</p>
          </>
        )}
      </div>

      {/* Facilities */}
      {Array.isArray(booking.facilities) && booking.facilities.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-500 mb-1">المرافق المطلوبة</p>
          <div className="flex flex-wrap gap-1.5">
            {booking.facilities.map((f) => {
              const Icon = FACILITY_ICONS[f];
              return (
                <span key={f} className="inline-flex items-center gap-1 bg-orange-50 border border-orange-200 text-orange-800 rounded-lg px-2 py-0.5 text-xs font-semibold">
                  {Icon && <Icon className="w-3 h-3" />}{FACILITY_LABELS[f] || f}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Recurrence info badge / block ─────────────────────────────────────────────
function RecurrenceBadge({ booking }) {
  if (!booking.recurrence_group_id) return null;
  const intervalLabel = booking.recurrence_type === 'weekly' ? 'أسبوعيًا' : 'شهريًا';
  const { firstDate, lastDate } = deriveRecurringDates(booking);
  return (
    <div className="mt-2 space-y-1.5">
      <span className="inline-flex items-center gap-1.5 bg-purple-100 text-purple-700 border border-purple-200 rounded-full px-2.5 py-0.5 text-xs font-bold">
        <RefreshCw className="w-3 h-3" />حجز متكرر
      </span>
      <div className="bg-purple-50 border border-purple-100 rounded-lg px-3 py-2 text-xs text-purple-800 space-y-0.5">
        <p><span className="font-bold">يتكرر:</span> {intervalLabel}</p>
        <p><span className="font-bold">عدد المرات:</span> {booking.total_occurrences || '—'} &nbsp;•&nbsp; <span className="font-bold">الحجز رقم:</span> {booking.occurrence_number || '—'} من {booking.total_occurrences || '—'}</p>
        {firstDate && <p><span className="font-bold">من:</span> {formatDateAr(firstDate)} &nbsp;•&nbsp; <span className="font-bold">إلى:</span> {formatDateAr(lastDate)}</p>}
      </div>
    </div>
  );
}

// ── Booking Card ──────────────────────────────────────────────────────────────
function BookingCard({ booking, actionLoading, actionError, onApprove, onReject, showActions, hasConflict, onDelete }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
      {/* Card body */}
      <div className="p-4 sm:p-5 space-y-3">
        {/* Name + Service */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-gray-400 text-xs font-semibold mb-0.5">
              <User className="w-3.5 h-3.5 flex-shrink-0" />مقدم الطلب
            </div>
            <p className="font-bold text-gray-900 break-words">{booking.requester_name}</p>
            <p className="text-sm text-gray-500 break-words">{booking.service_name}</p>
            <RecurrenceBadge booking={booking} />
            {hasConflict && (
              <div className="mt-2">
                <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 border border-red-200 rounded-full px-2.5 py-0.5 text-xs font-bold">
                  <AlertCircle className="w-3 h-3" />يوجد تعارض في الموعد
                </span>
              </div>
            )}
          </div>
          <div className="flex-shrink-0">
            <StatusBadge status={booking.status} />
          </div>
        </div>

        {/* Phone */}
        <div>
          <div className="flex items-center gap-1.5 text-gray-400 text-xs font-semibold mb-0.5">
            <Phone className="w-3.5 h-3.5 flex-shrink-0" />رقم الهاتف
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-900 text-sm" dir="ltr">{booking.phone}</span>
            <WhatsAppLink booking={booking} />
          </div>
        </div>

        {/* Booking-type-specific content */}
        {booking.booking_category === 'abo_talat' ? (
          <AboTalatDetails booking={booking} />
        ) : (
          <>
            {/* Date & Time (church) */}
            <div>
              <div className="flex items-center gap-1.5 text-gray-400 text-xs font-semibold mb-0.5">
                <Calendar className="w-3.5 h-3.5 flex-shrink-0" />التاريخ والوقت
              </div>
              <p className="font-bold text-gray-900 text-sm">{booking.booking_date}</p>
              <p className="text-sm text-gray-500">
                {formatArabic12(booking.start_time)} — {formatArabic12(booking.end_time)}
              </p>
            </div>

            {/* Places (church) */}
            <div>
              <div className="flex items-center gap-1.5 text-gray-400 text-xs font-semibold mb-1">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />الأماكن المطلوبة
              </div>
              <div className="flex flex-wrap gap-1.5">
                {booking.places?.length
                  ? booking.places.map((p) => (
                      <span key={p.id} className="bg-red-50 text-[#8B0000] border border-red-100 rounded-lg px-2 py-0.5 text-xs font-semibold break-words">
                        {formatPlace(p)}
                      </span>
                    ))
                  : <span className="text-sm text-gray-400">لم يتم تحديد أماكن</span>}
              </div>
            </div>
          </>
        )}

        {/* Notes */}
        {booking.notes && (
          <div>
            <div className="flex items-center gap-1.5 text-gray-400 text-xs font-semibold mb-0.5">
              <StickyNote className="w-3.5 h-3.5 flex-shrink-0" />ملاحظات
            </div>
            <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2 break-words">{booking.notes}</p>
          </div>
        )}

        {/* Admin note */}
        {booking.admin_note && (
          <div className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg break-words">
            سبب الرفض: {booking.admin_note}
          </div>
        )}

        {/* Action error */}
        {actionError?.id === booking.id && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{actionError.message}
          </div>
        )}
      </div>

      {/* Action buttons */}
      {showActions && booking.status === 'pending' && (
        <div className="border-t border-gray-100 px-4 sm:px-5 py-3 flex gap-3">
          <button onClick={() => onApprove(booking)} disabled={actionLoading === booking.id}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-xl font-bold text-sm transition-colors disabled:opacity-50">
            {actionLoading === booking.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            موافقة
          </button>
          <button onClick={() => onReject(booking)} disabled={actionLoading === booking.id}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-xl font-bold text-sm transition-colors disabled:opacity-50">
            <X className="w-4 h-4" />رفض
          </button>
        </div>
      )}

      {/* Created date footer */}
      <div className="px-4 sm:px-5 pb-3 text-xs text-gray-400 flex justify-between items-center" dir="rtl">
        {onDelete && (
          <button
            onClick={() => onDelete(booking)}
            className="text-red-650 hover:text-red-800 flex items-center gap-1.5 font-bold cursor-pointer transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>حذف الطلب</span>
          </button>
        )}
        <span className="text-gray-400" dir="ltr">
          {new Date(booking.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
        </span>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 bg-white rounded-2xl border border-dashed border-gray-200">
      <Loader2 className="w-10 h-10 text-[#8B0000] animate-spin" />
      <p className="text-gray-500 font-semibold text-lg">جارٍ تحميل الطلبات...</p>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 bg-white rounded-2xl border border-dashed border-gray-300">
      <FileText className="w-12 h-12 text-gray-300" />
      <p className="text-gray-500 font-semibold text-base sm:text-lg text-center px-4">{text}</p>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab]         = useState('pending');
  const [dashboardView, setDashboardView] = useState('list'); // 'list' | 'calendar'
  const [bookings, setBookings]           = useState([]);
  const [loading, setLoading]             = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [actionError, setActionError]     = useState(null);

  // Reject modal state
  const [rejectTarget, setRejectTarget]   = useState(null); // full booking object

  // Delete modal state
  const [deleteTarget, setDeleteTarget]   = useState(null); // full booking object

  // Approve scope modal state (only for recurring)
  const [approveTarget, setApproveTarget]   = useState(null); // full booking object
  const [approveScopeError, setApproveScopeError] = useState('');

  const [pf, setPf] = useState({ search: '', date: '' });
  const [af, setAf] = useState({ search: '', date: '', status: '', building: '', service: '' });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate('/admin/login');
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) navigate('/admin/login');
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('booking_requests')
      .select(`*, booking_request_places ( place_id, places ( id, building, floor, name ) )`)
      .order('created_at', { ascending: false });

    if (error) { console.error(error); setBookings([]); setLoading(false); return; }

    const enriched = (data || []).map((r) => ({
      ...r,
      places: r.booking_request_places?.map((item) => item.places).filter(Boolean) || [],
    }));
    setBookings(enriched);
    setLoading(false);
  }, []);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const handleLogout = async () => { await supabase.auth.signOut(); navigate('/admin/login'); };

  // ── Approve ───────────────────────────────────────────────────────────────
  const handleApprove = (booking) => {
    setActionError(null);
    setApproveScopeError('');
    if (booking.recurrence_group_id) {
      // Open scope modal for recurring bookings
      setApproveTarget(booking);
    } else {
      // Direct approve for one-time bookings (unchanged logic)
      doApproveSingle(booking);
    }
  };

  const doApproveSingle = async (booking) => {
    setActionLoading(booking.id);

    // ── Abo Talat: use the Abo Talat availability RPC ───────────────────────
    if (booking.booking_category === 'abo_talat') {
      const rpcArgs = booking.abo_talat_booking_type === 'retreat'
        ? {
            p_booking_type:     'retreat',
            p_check_in_date:    booking.check_in_date,
            p_check_out_date:   booking.check_out_date,
            p_check_out_period: booking.check_out_period,  // 'morning' | 'evening'
            p_exclude_id:       booking.id,
          }
        : {
            p_booking_type: 'one_day',
            p_date:         booking.booking_date,
            p_start_time:   booking.start_time,
            p_end_time:     booking.end_time,
            p_exclude_id:   booking.id,
          };
      const { data: avail, error: rpcErr } = await supabase.rpc('check_abo_talat_availability', rpcArgs);
      if (rpcErr) { setActionError({ id: booking.id, message: 'حدث خطأ أثناء التحقق من التوفر' }); setActionLoading(null); return; }
      if (avail === false) { setActionError({ id: booking.id, message: 'لا يمكن الموافقة لأن بيت أبوتلات أصبح محجوزًا في هذا الموعد' }); setActionLoading(null); return; }
      const { error } = await supabase.from('booking_requests').update({ status: 'approved' }).eq('id', booking.id);
      if (error) setActionError({ id: booking.id, message: 'حدث خطأ أثناء الموافقة' });
      setActionLoading(null);
      fetchBookings();
      return;
    }

    // ── Church place: use check_place_availability (original logic) ───────────
    const placeItems = booking.booking_request_places || [];
    const conflictingPlaces = [];
    for (const item of placeItems) {
      const { data, error } = await supabase.rpc('check_place_availability', {
        p_place_id: item.place_id, p_date: booking.booking_date,
        p_start_time: booking.start_time, p_end_time: booking.end_time, p_exclude_id: booking.id,
      });
      if (error) { setActionError({ id: booking.id, message: 'حدث خطأ أثناء التحقق من توفر الأماكن' }); setActionLoading(null); return; }
      if (data === false) {
        const placeDetails = booking.places.find(p => p.id === item.place_id);
        if (placeDetails) {
          conflictingPlaces.push(`${placeDetails.building} - ${placeDetails.floor} - ${placeDetails.name}`);
        }
      }
    }

    if (conflictingPlaces.length > 0) {
      setActionError({ 
        id: booking.id, 
        message: `لا يمكن الموافقة على هذا الطلب لأن المكان محجوز بالفعل في نفس الموعد أو في وقت متداخل\nالأماكن المتعارضة:\n${conflictingPlaces.map(p => `- ${p}`).join('\n')}` 
      });
      setActionLoading(null);
      return;
    }

    const { error } = await supabase.from('booking_requests').update({ status: 'approved' }).eq('id', booking.id);
    if (error) setActionError({ id: booking.id, message: 'حدث خطأ أثناء الموافقة' });
    setActionLoading(null);
    fetchBookings();
  };

  const handleApproveScopeConfirm = async (scope) => {
    if (!approveTarget) return;
    setApproveScopeError('');

    if (scope === 'single') {
      setApproveTarget(null);
      doApproveSingle(approveTarget);
      return;
    }

    // scope === 'all' — fetch all pending bookings in the same group
    setActionLoading(approveTarget.id);
    const { data: groupRows, error: fetchError } = await supabase
      .from('booking_requests')
      .select(`id, booking_date, start_time, end_time, booking_request_places ( place_id )`)
      .eq('recurrence_group_id', approveTarget.recurrence_group_id)
      .eq('status', 'pending');

    if (fetchError || !groupRows) {
      setApproveScopeError('حدث خطأ أثناء جلب الحجوزات المرتبطة');
      setActionLoading(null); return;
    }

    // Re-check availability for every occurrence
    const conflictingOccurrences = [];
    for (const row of groupRows) {
      for (const item of (row.booking_request_places || [])) {
        const { data: avail, error: rpcError } = await supabase.rpc('check_place_availability', {
          p_place_id:   item.place_id,
          p_date:       row.booking_date,
          p_start_time: row.start_time,
          p_end_time:   row.end_time,
          p_exclude_id: row.id,
        });
        if (rpcError) {
          setApproveScopeError('حدث خطأ أثناء التحقق من توفر الأماكن');
          setActionLoading(null); return;
        }
        if (avail === false) {
          const placeDetails = approveTarget.places.find(p => p.id === item.place_id);
          const placeName = placeDetails ? `${placeDetails.building} - ${placeDetails.floor} - ${placeDetails.name}` : `مبنى غير معروف`;
          conflictingOccurrences.push(`- ${row.booking_date} : ${placeName}`);
        }
      }
    }

    if (conflictingOccurrences.length > 0) {
      setApproveScopeError(`لا يمكن الموافقة على كل الحجوزات المتكررة لأن بعض الأماكن محجوزة في مواعيد متداخلة\n${conflictingOccurrences.join('\n')}`);
      setActionLoading(null);
      return;
    }

    // All clear — bulk approve
    const ids = groupRows.map((r) => r.id);
    const { error: updateError } = await supabase
      .from('booking_requests')
      .update({ status: 'approved' })
      .in('id', ids);

    if (updateError) {
      setApproveScopeError('حدث خطأ أثناء الموافقة على الحجوزات');
      setActionLoading(null); return;
    }

    setActionLoading(null);
    setApproveTarget(null);
    fetchBookings();
  };

  // ── Reject ────────────────────────────────────────────────────────────────
  const handleReject = (booking) => {
    setActionError(null);
    setRejectTarget(booking);
  };

  const handleRejectConfirm = async (reason, scope) => {
    if (!rejectTarget) return;
    setActionLoading(rejectTarget.id);

    if (!rejectTarget.recurrence_group_id || scope === 'single') {
      // Single reject (current behavior)
      const { error } = await supabase.from('booking_requests')
        .update({ status: 'rejected', admin_note: reason || null }).eq('id', rejectTarget.id);
      if (error) setActionError({ id: rejectTarget.id, message: 'حدث خطأ أثناء الرفض' });
    } else {
      // scope === 'all' — reject all pending in the group
      const { data: groupRows, error: fetchError } = await supabase
        .from('booking_requests')
        .select('id')
        .eq('recurrence_group_id', rejectTarget.recurrence_group_id)
        .eq('status', 'pending');

      if (fetchError || !groupRows) {
        setActionError({ id: rejectTarget.id, message: 'حدث خطأ أثناء جلب الحجوزات المرتبطة' });
        setActionLoading(null); setRejectTarget(null); return;
      }

      const ids = groupRows.map((r) => r.id);
      const { error: updateError } = await supabase
        .from('booking_requests')
        .update({ status: 'rejected', admin_note: reason || null })
        .in('id', ids);

      if (updateError) setActionError({ id: rejectTarget.id, message: 'حدث خطأ أثناء الرفض' });
    }

    setActionLoading(null);
    setRejectTarget(null);
    fetchBookings();
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = (booking) => {
    setActionError(null);
    setDeleteTarget(booking);
  };

  const handleDeleteConfirm = async (scope) => {
    if (!deleteTarget) return;
    setActionLoading(deleteTarget.id);
    setActionError(null);

    try {
      if (!deleteTarget.recurrence_group_id || scope === 'single') {
        // 1. Delete single booking_request_places safely
        const { error: placesErr } = await supabase
          .from('booking_request_places')
          .delete()
          .eq('booking_request_id', deleteTarget.id);

        if (placesErr) throw placesErr;

        // 2. Delete single booking_request
        const { error: reqErr } = await supabase
          .from('booking_requests')
          .delete()
          .eq('id', deleteTarget.id);

        if (reqErr) throw reqErr;
      } else {
        // scope === 'all'
        // 1. Get all bookings with same recurrence_group_id
        const { data: groupRows, error: fetchErr } = await supabase
          .from('booking_requests')
          .select('id')
          .eq('recurrence_group_id', deleteTarget.recurrence_group_id);

        if (fetchErr) throw fetchErr;

        if (groupRows && groupRows.length > 0) {
          const ids = groupRows.map(r => r.id);

          // 2. Delete booking_request_places for all ids
          const { error: placesErr } = await supabase
            .from('booking_request_places')
            .delete()
            .in('booking_request_id', ids);

          if (placesErr) throw placesErr;

          // 3. Delete all booking_requests in group
          const { error: reqErr } = await supabase
            .from('booking_requests')
            .delete()
            .eq('recurrence_group_id', deleteTarget.recurrence_group_id);

          if (reqErr) throw reqErr;
        }
      }

      alert('تم حذف الطلب بنجاح');
      setDeleteTarget(null);
      fetchBookings();
    } catch (err) {
      console.error(err);
      setActionError({
        id: deleteTarget.id,
        message: 'حدث خطأ أثناء حذف الطلب، برجاء المحاولة مرة أخرى'
      });
    } finally {
      setActionLoading(null);
    }
  };

  // ── Derived counts & filters ──────────────────────────────────────────────
  const pendingCount  = bookings.filter((b) => b.status === 'pending').length;
  const approvedCount = bookings.filter((b) => b.status === 'approved').length;
  const rejectedCount = bookings.filter((b) => b.status === 'rejected').length;

  const pendingBookings = bookings.filter((b) => {
    if (b.status !== 'pending') return false;
    if (pf.date && b.booking_date !== pf.date) return false;
    const t = pf.search.toLowerCase();
    return !t || b.requester_name?.toLowerCase().includes(t) || b.service_name?.toLowerCase().includes(t)
      || b.places?.some((p) => formatPlace(p).toLowerCase().includes(t));
  });

  const allBuildings = [...new Set(bookings.flatMap((b) => b.places?.map((p) => p?.building)).filter(Boolean))];
  const allBookings = bookings.filter((b) => {
    if (af.status   && b.status !== af.status) return false;
    if (af.date     && b.booking_date !== af.date) return false;
    if (af.building && !b.places?.some((p) => p?.building === af.building)) return false;
    if (af.service  && !b.service_name?.toLowerCase().includes(af.service.toLowerCase())) return false;
    if (af.search) {
      const t = af.search.toLowerCase();
      if (!b.requester_name?.toLowerCase().includes(t) && !b.phone?.includes(af.search)) return false;
    }
    return true;
  });

  const pendingCalendarBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (b.status !== 'pending') return false;
      const t = pf.search.toLowerCase();
      return !t || b.requester_name?.toLowerCase().includes(t) || b.service_name?.toLowerCase().includes(t)
        || b.places?.some((p) => formatPlace(p).toLowerCase().includes(t));
    });
  }, [bookings, pf.search]);

  const allCalendarBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (af.status   && b.status !== af.status) return false;
      if (af.building && !b.places?.some((p) => p?.building === af.building)) return false;
      if (af.service  && !b.service_name?.toLowerCase().includes(af.service.toLowerCase())) return false;
      if (af.search) {
        const t = af.search.toLowerCase();
        if (!b.requester_name?.toLowerCase().includes(t) && !b.phone?.includes(af.search)) return false;
      }
      return true;
    });
  }, [bookings, af.status, af.building, af.service, af.search]);

  const churchConflicts = useMemo(() => {
    const conflicts = new Set();
    const approvedChurch = bookings.filter(b => b.status === 'approved' && b.booking_category !== 'abo_talat');
    const pendingChurch = bookings.filter(b => b.status === 'pending' && b.booking_category !== 'abo_talat');

    for (const pending of pendingChurch) {
      const pPlaces = pending.places?.map(p => p.id) || [];
      if (pPlaces.length === 0) continue;

      const hasConflict = approvedChurch.some(approved => {
        if (approved.booking_date !== pending.booking_date) return false;
        if (!(pending.start_time < approved.end_time && pending.end_time > approved.start_time)) return false;
        const aPlaces = approved.places?.map(p => p.id) || [];
        return pPlaces.some(pid => aPlaces.includes(pid));
      });

      if (hasConflict) {
        conflicts.add(pending.id);
      }
    }
    return conflicts;
  }, [bookings]);

  return (
    <div className="space-y-4 sm:space-y-6 pb-12">
      {/* Reject modal */}
      {rejectTarget && (
        <RejectModal
          booking={rejectTarget}
          loading={actionLoading === rejectTarget.id}
          onConfirm={handleRejectConfirm}
          onCancel={() => setRejectTarget(null)}
        />
      )}

      {/* Approve scope modal (recurring only) */}
      {approveTarget && (
        <ApproveScopeModal
          booking={approveTarget}
          loading={actionLoading === approveTarget.id}
          scopeError={approveScopeError}
          onConfirm={handleApproveScopeConfirm}
          onCancel={() => { setApproveTarget(null); setApproveScopeError(''); setActionLoading(null); }}
        />
      )}

      {/* Delete modal */}
      {deleteTarget && (
        <DeleteModal
          booking={deleteTarget}
          loading={actionLoading === deleteTarget.id}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Page header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 sm:p-3 bg-red-50 text-[#8B0000] rounded-xl flex-shrink-0">
            <LayoutDashboard className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">لوحة تحكم المسؤول</h1>
            <p className="text-xs sm:text-sm text-gray-500">إدارة ومتابعة طلبات الحجز</p>
          </div>
        </div>
        <button onClick={handleLogout}
          className="flex items-center gap-2 text-gray-600 hover:text-red-600 font-semibold bg-gray-50 hover:bg-red-50 px-3 sm:px-4 py-2 rounded-lg transition-colors text-sm flex-shrink-0">
          <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />تسجيل الخروج
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatCard icon={<Clock className="w-5 h-5 sm:w-7 sm:h-7" />}  colorKey="yellow" label="في الانتظار" value={pendingCount} />
        <StatCard icon={<Check className="w-5 h-5 sm:w-7 sm:h-7" />}  colorKey="green"  label="تمت الموافقة" value={approvedCount} />
        <StatCard icon={<X className="w-5 h-5 sm:w-7 sm:h-7" />}      colorKey="red"    label="مرفوضة" value={rejectedCount} />
      </div>

      {/* Tabs & View Switch */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
        {/* Existing Tabs */}
        <div className="flex gap-2 bg-white p-1.5 rounded-xl border border-gray-100 shadow-sm w-full sm:w-fit">
          <TabBtn active={activeTab === 'pending'} onClick={() => setActiveTab('pending')} icon={<Inbox className="w-4 h-4" />}>
            الانتظار <span className="bg-yellow-100 text-yellow-700 rounded-full px-1.5 py-0.5 text-xs mr-1">{pendingCount}</span>
          </TabBtn>
          <TabBtn active={activeTab === 'all'} onClick={() => setActiveTab('all')} icon={<List className="w-4 h-4" />}>
            جميع الطلبات
          </TabBtn>
        </div>

        {/* View Switch */}
        <div className="flex gap-2 bg-white p-1.5 rounded-xl border border-gray-100 shadow-sm w-full sm:w-fit">
          <button
            onClick={() => setDashboardView('list')}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
              dashboardView === 'list' ? 'bg-[#8B0000] text-white' : 'text-gray-650 hover:bg-gray-100'
            }`}
          >
            <List className="w-4 h-4" /> قائمة الطلبات
          </button>
          <button
            onClick={() => setDashboardView('calendar')}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
              dashboardView === 'calendar' ? 'bg-[#8B0000] text-white' : 'text-gray-650 hover:bg-gray-100'
            }`}
          >
            <Calendar className="w-4 h-4" /> التقويم
          </button>
        </div>
      </div>

      {/* Tab 1: Pending */}
      {activeTab === 'pending' && (
        <div className="space-y-4">
          <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-gray-100">
            {/* Filter header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-[#8B0000] font-bold text-sm">
                <Filter className="w-4 h-4" />
                تصـفية الطلبات
              </div>
              {(pf.search || pf.date) && (
                <button
                  type="button"
                  onClick={() => setPf({ search: '', date: '' })}
                  className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-red-600 bg-gray-100 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  مسح التصفية
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Search field */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-500">البحث بالاسم أو رقم الهاتف</label>
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="ابحث هنا..."
                    value={pf.search}
                    onChange={(e) => setPf({ ...pf, search: e.target.value })}
                    className="w-full h-12 pr-9 pl-4 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#8B0000] outline-none text-sm bg-gray-50 focus:bg-white transition-colors"
                  />
                </div>
              </div>

              {/* Date field */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-500">التاريخ</label>
                <div
                  className="relative cursor-pointer"
                  onClick={(e) => {
                    const inp = e.currentTarget.querySelector('input[type="date"]');
                    if (inp) { try { if (inp.showPicker) inp.showPicker(); } catch (_) { inp.focus(); } }
                  }}
                >
                  <Calendar className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="date"
                    value={pf.date}
                    onChange={(e) => setPf({ ...pf, date: e.target.value })}
                    className="w-full h-12 pr-9 pl-4 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#8B0000] outline-none text-sm bg-gray-50 focus:bg-white transition-colors cursor-pointer appearance-none"
                  />
                  {!pf.date && (
                    <span className="absolute right-9 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none select-none">
                      اختر التاريخ
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {dashboardView === 'list' ? (
            <>
              {loading && <LoadingState />}
              {!loading && pendingBookings.length === 0 && <EmptyState text="لا توجد طلبات حجز في الانتظار" />}
              {!loading && pendingBookings.map((b) => (
                <BookingCard key={b.id} booking={b} actionLoading={actionLoading} actionError={actionError}
                  onApprove={handleApprove} onReject={handleReject} showActions hasConflict={churchConflicts.has(b.id)}
                  onDelete={handleDelete} />
              ))}
            </>
          ) : (
            <AdminBookingCalendar
              bookings={pendingCalendarBookings}
              selectedDateFilter={pf.date}
              onApprove={handleApprove}
              onReject={handleReject}
              onDelete={handleDelete}
              actionLoading={actionLoading}
              actionError={actionError}
              churchConflicts={churchConflicts}
            />
          )}
        </div>
      )}

      {/* Tab 2: All Bookings */}
      {activeTab === 'all' && (
        <div className="space-y-4">
          <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-gray-100">
            {/* Filter header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-[#8B0000] font-bold text-sm">
                <Filter className="w-4 h-4" />
                تصـفية الطلبات
              </div>
              {(af.search || af.date || af.status || af.building || af.service) && (
                <button
                  type="button"
                  onClick={() => setAf({ search: '', date: '', status: '', building: '', service: '' })}
                  className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-red-600 bg-gray-100 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  مسح التصفية
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Name / phone search */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-500">البحث بالاسم أو رقم الهاتف</label>
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="ابحث هنا..."
                    value={af.search}
                    onChange={(e) => setAf({ ...af, search: e.target.value })}
                    className="w-full h-12 pr-9 pl-4 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#8B0000] outline-none text-sm bg-gray-50 focus:bg-white transition-colors"
                  />
                </div>
              </div>

              {/* Service search */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-500">الخدمة أو الاجتماع</label>
                <input
                  type="text"
                  placeholder="اسم الخدمة..."
                  value={af.service}
                  onChange={(e) => setAf({ ...af, service: e.target.value })}
                  className="w-full h-12 px-4 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#8B0000] outline-none text-sm bg-gray-50 focus:bg-white transition-colors"
                />
              </div>

              {/* Date field */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-500">التاريخ</label>
                <div
                  className="relative cursor-pointer"
                  onClick={(e) => {
                    const inp = e.currentTarget.querySelector('input[type="date"]');
                    if (inp) { try { if (inp.showPicker) inp.showPicker(); } catch (_) { inp.focus(); } }
                  }}
                >
                  <Calendar className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="date"
                    value={af.date}
                    onChange={(e) => setAf({ ...af, date: e.target.value })}
                    className="w-full h-12 pr-9 pl-4 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#8B0000] outline-none text-sm bg-gray-50 focus:bg-white transition-colors cursor-pointer appearance-none"
                  />
                  {!af.date && (
                    <span className="absolute right-9 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none select-none">
                      اختر التاريخ
                    </span>
                  )}
                </div>
              </div>

              {/* Status filter */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-500">الحالة</label>
                <select
                  value={af.status}
                  onChange={(e) => setAf({ ...af, status: e.target.value })}
                  className="w-full h-12 px-4 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#8B0000] outline-none text-sm bg-gray-50 focus:bg-white transition-colors"
                >
                  <option value="">جميع الحالات</option>
                  <option value="pending">في انتظار الموافقة</option>
                  <option value="approved">تمت الموافقة</option>
                  <option value="rejected">مرفوض</option>
                </select>
              </div>

              {/* Building filter */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-500">المبنى</label>
                <select
                  value={af.building}
                  onChange={(e) => setAf({ ...af, building: e.target.value })}
                  className="w-full h-12 px-4 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#8B0000] outline-none text-sm bg-gray-50 focus:bg-white transition-colors"
                >
                  <option value="">جميع المباني</option>
                  {allBuildings.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            </div>
          </div>

          {dashboardView === 'list' ? (
            <>
              {loading && <LoadingState />}
              {!loading && allBookings.length === 0 && <EmptyState text="لا توجد طلبات مطابقة للبحث" />}
              {!loading && allBookings.length > 0 && (
                <div className="space-y-4">
                  {allBookings.map((b) => (
                    <BookingCard key={b.id} booking={b} actionLoading={null} actionError={null} showActions={false}
                      onDelete={handleDelete} />
                  ))}
                </div>
              )}
            </>
          ) : (
            <AdminBookingCalendar
              bookings={allCalendarBookings}
              selectedDateFilter={af.date}
              onApprove={handleApprove}
              onReject={handleReject}
              onDelete={handleDelete}
              actionLoading={actionLoading}
              actionError={actionError}
              churchConflicts={churchConflicts}
            />
          )}
        </div>
      )}
    </div>
  );
}
