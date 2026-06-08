import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar, Clock, MapPin, Phone, User, Check, X,
  ChevronRight, ChevronLeft, Building2, AlertCircle,
  UtensilsCrossed, Waves, Dumbbell, Loader2, RefreshCw, Trash2
} from 'lucide-react';
import { formatArabic12 } from './ArabicTimePicker';

// ── Constants & Formatter Helpers ──────────────────────────────────────────────
const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

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

function formatPlace(p) {
  return p ? `${p.building} - ${p.floor} - ${p.name}` : '—';
}

function normalizePhone(phone) {
  if (!phone) return '';
  let cleaned = phone.replace(/[\s\-]/g, '').replace(/[^\d+]/g, '');
  if (cleaned.startsWith('0')) cleaned = '+20' + cleaned.slice(1);
  return cleaned;
}

function formatDateAr(dateStr) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('ar-EG', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch { return dateStr; }
}

function getLocalISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isToday(date) {
  const today = new Date();
  return date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
}

// ── WhatsApp Message Helpers (cloned from AdminDashboard.jsx) ───────────────────
function deriveRecurringDates(booking) {
  if (!booking.recurrence_group_id) return { firstDate: null, lastDate: null };
  const base = booking.booking_date;
  const total = booking.total_occurrences || 1;
  const occNum = booking.occurrence_number || 1;
  const interval = booking.recurrence_type; // 'weekly' | 'monthly'

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

function buildFacilitiesBlock(facilities) {
  if (!Array.isArray(facilities) || facilities.length === 0) return '';
  return '\nالمرافق:\n' + facilities.map((f) => `- ${FACILITY_LABELS[f] || f}`).join('\n');
}

function buildWaMessage(booking) {
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

  const placeLines = booking.places?.length
    ? booking.places.map((p) => `- ${formatPlace(p)}`).join('\n')
    : null;
  const placesBlock = placeLines ? `الأماكن:\n${placeLines}` : 'الأماكن: لم يتم تحديد أماكن';

  const startAr = formatArabic12(booking.start_time);
  const endAr   = formatArabic12(booking.end_time);
  const isRecurring = !!booking.recurrence_group_id;

  if (!isRecurring) {
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
      className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-50 hover:bg-emerald-100 text-[#25D366] transition-colors flex-shrink-0">
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.855L.057 23.526a.75.75 0 0 0 .917.917l5.671-1.475A11.953 11.953 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.713 9.713 0 0 1-4.953-1.354l-.355-.21-3.667.954.975-3.562-.23-.366A9.712 9.712 0 0 1 2.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z"/>
      </svg>
    </a>
  );
}

const STATUS_COLORS = {
  approved: {
    bg: 'bg-green-50 hover:bg-green-100',
    border: 'border-green-200',
    text: 'text-green-800',
    badge: 'bg-green-100 text-green-800 border-green-200',
    label: 'تمت الموافقة',
  },
  pending: {
    bg: 'bg-yellow-50 hover:bg-yellow-100',
    border: 'border-yellow-200',
    text: 'text-yellow-800',
    badge: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    label: 'في انتظار الموافقة',
  },
  rejected: {
    bg: 'bg-red-50 hover:bg-red-100',
    border: 'border-red-200',
    text: 'text-red-800',
    badge: 'bg-red-100 text-red-800 border-red-200',
    label: 'مرفوضة',
  }
};

// ── Event Normalization Helper ─────────────────────────────────────────────
// Maps booking requests into day-by-day segments for the calendar grid
function normalizeBookingsToEvents(bookings) {
  const events = [];

  bookings.forEach(b => {
    if (b.booking_category === 'abo_talat') {
      if (b.abo_talat_booking_type === 'retreat') {
        // Retreat spans multiple days
        const startStr = b.check_in_date;
        const endStr = b.check_out_date;
        if (!startStr || !endStr) return;

        const start = new Date(startStr + 'T00:00:00');
        const end = new Date(endStr + 'T00:00:00');

        let occupiedEnd = new Date(end);
        if (b.check_out_period === 'morning') {
          occupiedEnd.setDate(occupiedEnd.getDate() - 1);
        }

        let current = new Date(start);
        while (current <= occupiedEnd) {
          const dateStr = current.toISOString().split('T')[0];
          events.push({
            id: `${b.id}-${dateStr}`,
            bookingId: b.id,
            date: dateStr,
            type: 'abo_talat_retreat',
            status: b.status,
            booking: b
          });
          current.setDate(current.getDate() + 1);
        }
      } else {
        // One day Abo Talat
        if (b.booking_date) {
          events.push({
            id: `${b.id}-${b.booking_date}`,
            bookingId: b.id,
            date: b.booking_date,
            type: 'abo_talat_one_day',
            status: b.status,
            booking: b
          });
        }
      }
    } else {
      // Church booking
      if (b.booking_date) {
        events.push({
          id: `${b.id}-${b.booking_date}`,
          bookingId: b.id,
          date: b.booking_date,
          type: 'church',
          status: b.status,
          booking: b
        });
      }
    }
  });

  return events;
}

// Comparer for sorting events chronologically on a single day
const sortEvents = (a, b) => {
  if (a.type === 'abo_talat_retreat' && b.type !== 'abo_talat_retreat') return -1;
  if (a.type !== 'abo_talat_retreat' && b.type === 'abo_talat_retreat') return 1;
  if (a.type === 'abo_talat_retreat' && b.type === 'abo_talat_retreat') return 0;

  const timeA = a.booking.start_time || '';
  const timeB = b.booking.start_time || '';
  return timeA.localeCompare(timeB);
};

// ── Sub-component: Individual Event Item Card ──────────────────────────────
function CalendarBookingItem({ ev, onClick, hasConflict }) {
  const b = ev.booking;
  const statusColor = STATUS_COLORS[b.status] || STATUS_COLORS.pending;

  const startAr = formatArabic12(b.start_time);
  const endAr = formatArabic12(b.end_time);
  const isRecurring = !!b.recurrence_group_id;

  return (
    <div
      onClick={onClick}
      className="p-4 rounded-xl border bg-white hover:shadow-md transition-shadow cursor-pointer space-y-2.5 relative overflow-hidden border-gray-200"
    >
      {/* Top Status Indicator Color Bar */}
      <div className={`absolute right-0 top-0 bottom-0 w-1.5 ${
        b.status === 'approved' ? 'bg-green-500' : b.status === 'pending' ? 'bg-yellow-500' : 'bg-red-500'
      }`} />

      <div className="pr-2 space-y-2">
        {/* Badges row */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {ev.type === 'abo_talat_one_day' && (
              <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 border border-orange-200 rounded-full px-2 py-0.5 text-[10px] font-bold">
                <Building2 className="w-3 h-3" /> بيت أبوتلات
              </span>
            )}
            {ev.type === 'abo_talat_retreat' && (
              <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-700 border border-purple-200 rounded-full px-2 py-0.5 text-[10px] font-bold">
                <Building2 className="w-3 h-3" /> خلوة بيت أبوتلات
              </span>
            )}
            {isRecurring && (
              <span className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-full px-2 py-0.5 text-[10px] font-bold">
                <RefreshCw className="w-3 h-3 animate-spin-slow" /> حجز متكرر
              </span>
            )}
            {hasConflict && (
              <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 border border-red-200 rounded-full px-2 py-0.5 text-[10px] font-bold">
                <AlertCircle className="w-3 h-3" /> تعارض
              </span>
            )}
          </div>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusColor.badge}`}>
            {statusColor.label}
          </span>
        </div>

        {/* Requester Name & Service */}
        <div>
          <h4 className="font-bold text-gray-900 text-sm leading-tight">{b.requester_name}</h4>
          <p className="text-xs text-gray-500 font-semibold mt-0.5">{b.service_name}</p>
        </div>

        {/* Date and Time Details */}
        <div className="space-y-1.5 text-xs text-gray-600">
          {ev.type === 'church' && (
            <>
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                <span>من {startAr} إلى {endAr}</span>
              </div>
              <div className="flex items-start gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                <span className="font-semibold text-gray-700">
                  {b.places?.length
                    ? b.places.map(p => formatPlace(p)).join(' ، ')
                    : 'لم يتم تحديد أماكن'}
                </span>
              </div>
            </>
          )}

          {ev.type === 'abo_talat_one_day' && (
            <>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                <span>التاريخ: {b.booking_date}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                <span>الوقت: من {startAr} إلى {endAr}</span>
              </div>
              {Array.isArray(b.facilities) && b.facilities.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {b.facilities.map(f => (
                    <span key={f} className="bg-orange-50 border border-orange-100 text-orange-800 rounded px-1.5 py-0.5 text-[10px] font-semibold">
                      {FACILITY_LABELS[f] || f}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}

          {ev.type === 'abo_talat_retreat' && (
            <>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                <span>من {b.check_in_date} إلى {b.check_out_date}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                <span>المغادرة: {b.check_out_period === 'morning' ? 'صباحًا' : 'مساءً'}</span>
              </div>
              {Array.isArray(b.facilities) && b.facilities.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {b.facilities.map(f => (
                    <span key={f} className="bg-purple-50 border border-purple-100 text-purple-800 rounded px-1.5 py-0.5 text-[10px] font-semibold">
                      {FACILITY_LABELS[f] || f}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Recurring Occurrences details */}
        {isRecurring && b.occurrence_number && b.total_occurrences && (
          <div className="pt-1">
            <p className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded inline-block">
              تكرار: {b.occurrence_number} من {b.total_occurrences}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main AdminBookingCalendar Component ──────────────────────────────────────────
export default function AdminBookingCalendar({
  bookings,
  selectedDateFilter,
  onApprove,
  onReject,
  onDelete,
  actionLoading,
  actionError,
  churchConflicts
}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('month'); // 'month' | 'week' | 'day'
  const [selectedEvent, setSelectedEvent] = useState(null);

  // Sync date selection with filter when it changes
  useEffect(() => {
    if (selectedDateFilter) {
      const parsed = new Date(selectedDateFilter + 'T00:00:00');
      if (!isNaN(parsed.getTime())) {
        setCurrentDate(parsed);
      }
    }
  }, [selectedDateFilter]);

  // Close details modal if the selected booking is no longer in the bookings list (i.e. was deleted)
  useEffect(() => {
    if (selectedEvent) {
      const exists = bookings.some(b => b.id === selectedEvent.bookingId);
      if (!exists) {
        setSelectedEvent(null);
      }
    }
  }, [bookings, selectedEvent]);

  // Normalize all bookings to calendar events
  const eventsByDate = useMemo(() => {
    const normalized = normalizeBookingsToEvents(bookings);
    const map = {};
    normalized.forEach(ev => {
      if (!map[ev.date]) {
        map[ev.date] = [];
      }
      map[ev.date].push(ev);
    });
    return map;
  }, [bookings]);

  // Keep details modal booking in sync with latest bookings state
  const activeBooking = useMemo(() => {
    if (!selectedEvent) return null;
    return bookings.find(b => b.id === selectedEvent.bookingId) || selectedEvent.booking;
  }, [selectedEvent, bookings]);

  // Navigate actions
  const handlePrev = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    } else if (viewMode === 'week') {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 7);
      setCurrentDate(d);
    } else {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 1);
      setCurrentDate(d);
    }
  };

  const handleNext = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    } else if (viewMode === 'week') {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + 7);
      setCurrentDate(d);
    } else {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + 1);
      setCurrentDate(d);
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Generate appropriate titles for controls
  const viewTitle = useMemo(() => {
    if (viewMode === 'month') {
      return currentDate.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
    } else if (viewMode === 'week') {
      const currentDay = currentDate.getDay();
      const sunday = new Date(currentDate);
      sunday.setDate(sunday.getDate() - currentDay);
      const saturday = new Date(sunday);
      saturday.setDate(saturday.getDate() + 6);

      const startDay = sunday.getDate();
      const startMonth = sunday.toLocaleDateString('ar-EG', { month: 'short' });
      const endDay = saturday.getDate();
      const endMonth = saturday.toLocaleDateString('ar-EG', { month: 'short', year: 'numeric' });

      if (sunday.getMonth() === saturday.getMonth()) {
        return `${startDay} - ${endDay} ${startMonth} ${saturday.getFullYear()}`;
      } else {
        return `${startDay} ${startMonth} - ${endDay} ${endMonth}`;
      }
    } else {
      return currentDate.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }
  }, [currentDate, viewMode]);

  // Compute days of current month grid (Sunday to Saturday)
  const monthGridDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startOffset = firstDay.getDay(); // Sunday=0, Monday=1 etc.
    const totalDays = lastDay.getDate();

    const days = [];

    // Prev month padding
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      days.push({
        date: d,
        dateStr: getLocalISODate(d),
        isCurrentMonth: false,
        dayNumber: prevMonthLastDay - i
      });
    }

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      const d = new Date(year, month, i);
      days.push({
        date: d,
        dateStr: getLocalISODate(d),
        isCurrentMonth: true,
        dayNumber: i
      });
    }

    // Next month padding
    const remaining = days.length % 7;
    if (remaining > 0) {
      const pad = 7 - remaining;
      for (let i = 1; i <= pad; i++) {
        const d = new Date(year, month + 1, i);
        days.push({
          date: d,
          dateStr: getLocalISODate(d),
          isCurrentMonth: false,
          dayNumber: i
        });
      }
    }

    return days;
  }, [currentDate]);

  // Compute current week days (Sunday to Saturday)
  const weekDays = useMemo(() => {
    const currentDay = currentDate.getDay();
    const days = [];
    for (let i = 0; i < 7; i++) {
      const diff = i - currentDay;
      const d = new Date(currentDate);
      d.setDate(d.getDate() + diff);
      days.push({
        date: d,
        dateStr: getLocalISODate(d),
        dayNumber: d.getDate(),
        dayName: WEEKDAYS[i]
      });
    }
    return days;
  }, [currentDate]);

  // For Mobile Month View: List only days of this month that contain bookings
  const activeMonthDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);

    const list = [];
    const curr = new Date(start);
    while (curr <= end) {
      const dateStr = getLocalISODate(curr);
      const dayEvents = eventsByDate[dateStr] || [];
      if (dayEvents.length > 0) {
        list.push({
          date: new Date(curr),
          dateStr,
          dayNumber: curr.getDate(),
          dayName: WEEKDAYS[curr.getDay()],
          events: dayEvents.sort(sortEvents)
        });
      }
      curr.setDate(curr.getDate() + 1);
    }
    return list;
  }, [currentDate, eventsByDate]);

  // Click on event pill in Month view
  const handleEventClick = (e, ev) => {
    e.stopPropagation();
    setSelectedEvent(ev);
  };

  return (
    <div className="space-y-4">
      {/* Calendar Header Controls */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        {/* Navigation buttons */}
        <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-1.5 border border-gray-200 w-full md:w-auto justify-between md:justify-start">
          <button onClick={handlePrev} className="p-2 hover:bg-white rounded-lg transition-colors cursor-pointer" title="السابق">
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
          <button onClick={handleToday} className="px-4 py-1.5 hover:bg-white text-gray-700 font-bold text-sm rounded-lg transition-colors cursor-pointer">
            اليوم
          </button>
          <button onClick={handleNext} className="p-2 hover:bg-white rounded-lg transition-colors cursor-pointer" title="التالي">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Current Period Title */}
        <h2 className="text-base md:text-lg font-bold text-gray-800 text-center order-first md:order-none">
          {viewTitle}
        </h2>

        {/* View Mode Selector */}
        <div className="flex gap-1.5 bg-gray-50 rounded-xl p-1.5 border border-gray-200 w-full md:w-auto">
          <button
            onClick={() => setViewMode('month')}
            className={`flex-1 md:flex-none px-4 py-1.5 rounded-lg text-xs md:text-sm font-bold transition-colors cursor-pointer ${
              viewMode === 'month' ? 'bg-[#8B0000] text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            شهر
          </button>
          <button
            onClick={() => setViewMode('week')}
            className={`flex-1 md:flex-none px-4 py-1.5 rounded-lg text-xs md:text-sm font-bold transition-colors cursor-pointer ${
              viewMode === 'week' ? 'bg-[#8B0000] text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            أسبوع
          </button>
          <button
            onClick={() => setViewMode('day')}
            className={`flex-1 md:flex-none px-4 py-1.5 rounded-lg text-xs md:text-sm font-bold transition-colors cursor-pointer ${
              viewMode === 'day' ? 'bg-[#8B0000] text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            يوم
          </button>
        </div>
      </div>

      {/* ────────────────── 1. MONTH VIEW ────────────────── */}
      {viewMode === 'month' && (
        <>
          {/* Desktop Month View (7 Columns Grid) */}
          <div className="hidden md:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50">
              {WEEKDAYS.map(day => (
                <div key={day} className="py-3 text-center text-xs font-bold text-gray-500">
                  {day}
                </div>
              ))}
            </div>
            {/* Grid days */}
            <div className="grid grid-cols-7 divide-x divide-y divide-gray-100 bg-gray-100">
              {monthGridDays.map(day => {
                const dayEvents = (eventsByDate[day.dateStr] || []).sort(sortEvents);
                const isTodayDate = isToday(day.date);

                return (
                  <div
                    key={day.dateStr}
                    onClick={() => {
                      setCurrentDate(day.date);
                      setViewMode('day');
                    }}
                    className={`min-h-[120px] p-2 bg-white flex flex-col justify-between cursor-pointer transition-colors hover:bg-gray-50/50 ${
                      !day.isCurrentMonth && 'text-gray-300 bg-gray-50/30'
                    }`}
                  >
                    {/* Date label */}
                    <div className="flex justify-between items-center mb-1">
                      <span className={`text-xs font-black w-6 h-6 flex items-center justify-center rounded-full ${
                        isTodayDate ? 'bg-[#8B0000] text-white' : day.isCurrentMonth ? 'text-gray-700' : 'text-gray-300'
                      }`}>
                        {day.dayNumber}
                      </span>
                    </div>

                    {/* Events list */}
                    <div className="flex-1 flex flex-col gap-1 overflow-hidden">
                      {dayEvents.slice(0, 3).map(ev => {
                        const statusColor = STATUS_COLORS[ev.status] || STATUS_COLORS.pending;
                        const hasConflict = ev.type === 'church' && churchConflicts.has(ev.bookingId);
                        return (
                          <div
                            key={ev.id}
                            onClick={(e) => handleEventClick(e, ev)}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold truncate border flex items-center gap-1 ${statusColor.bg} ${statusColor.text} ${statusColor.border}`}
                            title={`${ev.booking.requester_name} - ${ev.booking.service_name}`}
                          >
                            {hasConflict && <AlertCircle className="w-2.5 h-2.5 flex-shrink-0" />}
                            <span className="truncate">
                              {ev.type === 'church' ? '' : (ev.type === 'abo_talat_retreat' ? 'خلوة: ' : 'بيت: ')}
                              {ev.booking.service_name}
                            </span>
                          </div>
                        );
                      })}
                      {dayEvents.length > 3 && (
                        <div className="text-[10px] font-bold text-gray-400 mt-0.5">
                          + {dayEvents.length - 3} المزيد
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mobile Month View (Vertical Active Days Feed) */}
          <div className="block md:hidden space-y-3">
            {activeMonthDays.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
                <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-gray-400">لا توجد حجوزات في هذا الشهر</p>
              </div>
            ) : (
              activeMonthDays.map(day => (
                <div key={day.dateStr} className="space-y-2">
                  {/* Day Date Title */}
                  <h3 className="text-xs font-bold text-gray-500 mr-1 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#8B0000]" />
                    {day.dayName}، {day.dayNumber} {currentDate.toLocaleDateString('ar-EG', { month: 'short' })}
                  </h3>
                  {/* Day Events */}
                  <div className="grid grid-cols-1 gap-2.5">
                    {day.events.map(ev => (
                      <CalendarBookingItem
                        key={ev.id}
                        ev={ev}
                        onClick={() => setSelectedEvent(ev)}
                        hasConflict={ev.type === 'church' && churchConflicts.has(ev.bookingId)}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* ────────────────── 2. WEEK VIEW ────────────────── */}
      {viewMode === 'week' && (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {weekDays.map(day => {
            const dayEvents = (eventsByDate[day.dateStr] || []).sort(sortEvents);
            const isTodayDate = isToday(day.date);

            return (
              <div
                key={day.dateStr}
                className={`flex flex-col bg-white rounded-2xl border p-3 min-h-[300px] shadow-sm ${
                  isTodayDate ? 'border-[#8B0000] ring-1 ring-[#8B0000]/10' : 'border-gray-100'
                }`}
              >
                {/* Column Day Header */}
                <div className="border-b border-gray-100 pb-2 mb-3 text-center">
                  <p className="text-xs font-bold text-gray-400">{day.dayName}</p>
                  <p className={`text-lg font-black inline-flex w-7 h-7 items-center justify-center rounded-full mt-1 ${
                    isTodayDate ? 'bg-[#8B0000] text-white' : 'text-gray-800'
                  }`}>
                    {day.dayNumber}
                  </p>
                </div>

                {/* Day events stack */}
                <div className="flex-1 flex flex-col gap-2.5">
                  {dayEvents.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center border border-dashed border-gray-100 rounded-xl min-h-[100px] md:min-h-0 bg-gray-50/50">
                      <p className="text-[10px] md:text-xs text-gray-400 font-semibold">لا توجد حجوزات</p>
                    </div>
                  ) : (
                    dayEvents.map(ev => (
                      <CalendarBookingItem
                        key={ev.id}
                        ev={ev}
                        onClick={() => setSelectedEvent(ev)}
                        hasConflict={ev.type === 'church' && churchConflicts.has(ev.bookingId)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ────────────────── 3. DAY VIEW ────────────────── */}
      {viewMode === 'day' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 md:p-6 shadow-sm">
          {(() => {
            const dateStr = getLocalISODate(currentDate);
            const dayEvents = (eventsByDate[dateStr] || []).sort(sortEvents);

            if (dayEvents.length === 0) {
              return (
                <div className="py-16 text-center">
                  <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-bold">لا توجد حجوزات في هذا اليوم</p>
                </div>
              );
            }

            return (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-500 border-b border-gray-100 pb-2">
                  جدول مواعيد اليوم ({dayEvents.length} طلبات حجز)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {dayEvents.map(ev => (
                    <CalendarBookingItem
                      key={ev.id}
                      ev={ev}
                      onClick={() => setSelectedEvent(ev)}
                      hasConflict={ev.type === 'church' && churchConflicts.has(ev.bookingId)}
                    />
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ────────────────── DETAILS MODAL (z-40 so confirmation modals z-50 stack on top) ────────────────── */}
      {selectedEvent && activeBooking && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200" dir="rtl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 bg-gray-50">
              <h3 className="font-black text-gray-900 text-base flex items-center gap-2">
                <User className="w-4 h-4 text-gray-500" />
                تفاصيل طلب الحجز
              </h3>
              <div className="flex items-center gap-2">
                {onDelete && (
                  <button
                    onClick={() => onDelete(activeBooking)}
                    className="p-2 text-red-650 hover:bg-red-50 rounded-xl cursor-pointer transition-colors flex items-center gap-1 text-xs font-bold"
                    title="حذف الطلب"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden sm:inline">حذف الطلب</span>
                  </button>
                )}
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Status & Name Header */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-gray-400 font-semibold mb-0.5">مقدم الطلب</p>
                  <h4 className="text-lg font-black text-gray-900 leading-tight">{activeBooking.requester_name}</h4>
                  <p className="text-sm text-gray-500 font-bold mt-0.5">{activeBooking.service_name}</p>
                </div>
                <div>
                  {(() => {
                    const statusColor = STATUS_COLORS[activeBooking.status] || STATUS_COLORS.pending;
                    return (
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${statusColor.badge}`}>
                        {statusColor.label}
                      </span>
                    );
                  })()}
                </div>
              </div>

              {/* Contact info with WhatsApp */}
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-150 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400 font-semibold mb-0.5">رقم الهاتف</p>
                  <p className="font-black text-gray-900" dir="ltr">{activeBooking.phone}</p>
                </div>
                <WhatsAppLink booking={activeBooking} />
              </div>

              {/* Conflict indicator */}
              {selectedEvent.type === 'church' && churchConflicts.has(activeBooking.id) && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-xs font-semibold">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">يوجد تعارض في الموعد!</p>
                    <p className="text-[10px] mt-0.5 opacity-90">المكان محجوز بالفعل لمجموعة أخرى في نفس الوقت.</p>
                  </div>
                </div>
              )}

              {/* Booking-category specific detail cards */}
              {activeBooking.booking_category === 'abo_talat' ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 border border-orange-200 rounded-full px-2.5 py-0.5 text-xs font-bold">
                      <Building2 className="w-3 h-3" /> بيت أبوتلات
                    </span>
                  </div>

                  <div className="bg-orange-50/50 border border-orange-100 rounded-xl p-3.5 text-xs text-orange-950 space-y-2">
                    <p><span className="font-bold">نوع الحجز:</span> {activeBooking.abo_talat_booking_type === 'retreat' ? 'خلوة' : 'يوم واحد'}</p>
                    {activeBooking.abo_talat_booking_type === 'retreat' ? (
                      <>
                        <p><span className="font-bold">تاريخ الوصول:</span> {formatDateAr(activeBooking.check_in_date)}</p>
                        <p><span className="font-bold">تاريخ المغادرة:</span> {formatDateAr(activeBooking.check_out_date)}</p>
                        <p><span className="font-bold">وقت المغادرة:</span> {activeBooking.check_out_period === 'morning' ? 'صباحًا' : 'مساءً'}</p>
                      </>
                    ) : (
                      <>
                        <p><span className="font-bold">التاريخ:</span> {formatDateAr(activeBooking.booking_date)}</p>
                        <p><span className="font-bold">الوقت:</span> {formatArabic12(activeBooking.start_time)} — {formatArabic12(activeBooking.end_time)}</p>
                      </>
                    )}
                  </div>

                  {/* Facilities */}
                  {Array.isArray(activeBooking.facilities) && activeBooking.facilities.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-gray-500 mb-1.5">المرافق المطلوبة</p>
                      <div className="flex flex-wrap gap-1.5">
                        {activeBooking.facilities.map(f => {
                          const Icon = FACILITY_ICONS[f];
                          return (
                            <span key={f} className="inline-flex items-center gap-1 bg-orange-50 border border-orange-150 text-orange-850 rounded-lg px-2.5 py-1 text-xs font-semibold">
                              {Icon && <Icon className="w-3.5 h-3.5" />}{FACILITY_LABELS[f] || f}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                // Church layout
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-bold text-gray-400 mb-1">التاريخ والوقت</p>
                    <div className="bg-red-50/30 border border-red-100 rounded-xl p-3 text-xs space-y-1.5 text-gray-800">
                      <p><span className="font-bold text-gray-500">اليوم:</span> {formatDateAr(activeBooking.booking_date)}</p>
                      <p><span className="font-bold text-gray-500">الوقت:</span> من {formatArabic12(activeBooking.start_time)} إلى {formatArabic12(activeBooking.end_time)}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-gray-400 mb-1.5">الأماكن المطلوبة</p>
                    <div className="flex flex-wrap gap-1.5">
                      {activeBooking.places?.length ? (
                        activeBooking.places.map(p => (
                          <span key={p.id} className="bg-red-50 text-[#8B0000] border border-red-100 rounded-lg px-2.5 py-1 text-xs font-semibold">
                            {formatPlace(p)}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-gray-400">لم يتم تحديد أماكن</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Recurrence Details */}
              {activeBooking.recurrence_group_id && (
                <div>
                  <p className="text-xs font-bold text-gray-400 mb-1.5">جدولة التكرار</p>
                  <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 text-xs text-purple-900 space-y-1">
                    <p><span className="font-bold">التكرار:</span> {activeBooking.recurrence_type === 'weekly' ? 'أسبوعيًا' : 'شهريًا'}</p>
                    <p>
                      <span className="font-bold">حالة التكرار:</span> الحجز رقم {activeBooking.occurrence_number || '—'} من إجمالي {activeBooking.total_occurrences || '—'} تكرارًا.
                    </p>
                    {(() => {
                      const { firstDate, lastDate } = deriveRecurringDates(activeBooking);
                      if (!firstDate) return null;
                      return (
                        <p>
                          <span className="font-bold">المدى الكامل:</span> من {formatDateAr(firstDate)} إلى {formatDateAr(lastDate)}
                        </p>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Notes */}
              {activeBooking.notes && (
                <div>
                  <p className="text-xs font-bold text-gray-400 mb-1">ملاحظات مقدم الطلب</p>
                  <p className="text-xs text-gray-700 bg-gray-50 rounded-xl p-3.5 border border-gray-150 break-words leading-relaxed">
                    {activeBooking.notes}
                  </p>
                </div>
              )}

              {/* Admin Note / Rejected Reason */}
              {activeBooking.admin_note && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-100 p-3.5 rounded-xl break-words leading-relaxed">
                  <span className="font-bold block mb-1">سبب الرفض:</span>
                  {activeBooking.admin_note}
                </div>
              )}

              {/* Action error block inside modal */}
              {actionError?.id === activeBooking.id && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-xs font-semibold">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{actionError.message}</span>
                </div>
              )}
            </div>

            {/* Modal Actions Footer */}
            <div className="border-t border-gray-100 px-5 py-4 bg-gray-50 flex gap-3">
              {activeBooking.status === 'pending' ? (
                <>
                  <button
                    onClick={() => onApprove(activeBooking)}
                    disabled={actionLoading === activeBooking.id}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-sm cursor-pointer transition-colors disabled:opacity-50"
                  >
                    {actionLoading === activeBooking.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    موافقة
                  </button>
                  <button
                    onClick={() => onReject(activeBooking)}
                    disabled={actionLoading === activeBooking.id}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-650 hover:bg-red-700 text-white rounded-xl font-bold text-sm cursor-pointer transition-colors disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                    رفض
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="w-full py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl font-bold text-sm cursor-pointer transition-colors"
                >
                  إغلاق
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
