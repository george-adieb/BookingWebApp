import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  Send, CheckCircle2, AlertCircle, Loader2,
  RefreshCw, Calendar, UtensilsCrossed, Waves, Dumbbell, Building2,
} from 'lucide-react';
import ArabicTimePicker, { formatArabic12 } from '../components/ArabicTimePicker';
import AboTalatCalendarView from '../components/AboTalatCalendarView';

// ── Email notification (fire-and-forget) ─────────────────────────────────────
const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function sendAboTalatEmail(payload) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-booking-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error('[sendAboTalatEmail] Failed:', err);
  }
}

// ── Date helpers (shared with church booking) ─────────────────────────────────
function addWeeks(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + 7 * n);
  return d.toISOString().split('T')[0];
}

function addMonths(dateStr, n) {
  const d = new Date(dateStr);
  const targetMonth = d.getMonth() + n;
  const year = d.getFullYear() + Math.floor(targetMonth / 12);
  const month = ((targetMonth % 12) + 12) % 12;
  const day = d.getDate();
  const lastDay = new Date(year, month + 1, 0).getDate();
  d.setFullYear(year, month, Math.min(day, lastDay));
  return d.toISOString().split('T')[0];
}

function generateOccurrenceDates(baseDate, interval, endType, count, untilDate) {
  const dates = [baseDate];
  if (endType === 'count') {
    for (let i = 1; i < count; i++) {
      dates.push(interval === 'weekly' ? addWeeks(baseDate, i) : addMonths(baseDate, i));
    }
  } else {
    let i = 1;
    while (true) {
      const next = interval === 'weekly' ? addWeeks(baseDate, i) : addMonths(baseDate, i);
      if (next > untilDate) break;
      dates.push(next);
      i++;
      if (i > 365) break;
    }
  }
  return dates;
}

function formatDateAr(dateStr) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('ar-EG', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch { return dateStr; }
}

// ── Facility definitions ──────────────────────────────────────────────────────
const FACILITIES = [
  { id: 'kitchen',  label: 'مطبخ',        icon: UtensilsCrossed },
  { id: 'pool',     label: 'حمام سباحة',  icon: Waves },
  { id: 'playground', label: 'ملعب',      icon: Dumbbell },
];

const FACILITY_LABELS = {
  kitchen:    'مطبخ',
  pool:       'حمام سباحة',
  playground: 'ملعب',
};

export default function AboTalatBookingPage() {
  const [view, setView] = useState('calendar'); // 'calendar' | 'form'
  const [selectedDateFromCalendar, setSelectedDateFromCalendar] = useState('');

  // ── Core fields ────────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    requester_name: '',
    service_name:   '',
    phone:          '',
    notes:          '',
  });

  // Booking type: 'one_day' | 'retreat'
  const [aboType, setAboType] = useState('one_day');

  // one_day fields
  const [bookingDate, setBookingDate]   = useState('');
  const [startTime, setStartTime]       = useState('18:00');
  const [endTime, setEndTime]           = useState('20:00');

  // retreat fields
  const [checkInDate, setCheckInDate]   = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [checkOutPeriod, setCheckOutPeriod] = useState('morning'); // 'morning' | 'evening'

  // Prefill dates when selected from calendar
  React.useEffect(() => {
    if (selectedDateFromCalendar) {
      setBookingDate(selectedDateFromCalendar);
      setCheckInDate(selectedDateFromCalendar);
    }
  }, [selectedDateFromCalendar]);

  // Facilities
  const [selectedFacilities, setSelectedFacilities] = useState([]);

  // Recurrence (one_day only)
  const [recurrenceType, setRecurrenceType] = useState('once');   // 'once' | 'recurring'
  const [repeatInterval, setRepeatInterval] = useState('weekly');
  const [repeatEndType, setRepeatEndType]   = useState('count');
  const [repeatCount, setRepeatCount]       = useState(4);
  const [repeatUntil, setRepeatUntil]       = useState('');

  // UI state
  const [error, setError]                           = useState('');
  const [unavailableDates, setUnavailableDates]     = useState([]);
  const [success, setSuccess]                       = useState(false);
  const [successCount, setSuccessCount]             = useState(1);
  const [isSubmitting, setIsSubmitting]             = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError(''); setUnavailableDates([]);
  };

  const toggleFacility = (id) => {
    setSelectedFacilities((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };

  const clearError = () => { setError(''); setUnavailableDates([]); };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();

    // Validate common fields
    if (!form.requester_name.trim()) { setError('يجب إدخال الاسم'); return; }
    if (!form.phone.trim())          { setError('يجب إدخال رقم الهاتف'); return; }
    if (!form.service_name.trim())   { setError('يجب إدخال اسم الخدمة أو الاجتماع'); return; }

    if (aboType === 'one_day') {
      // Validate one_day
      if (!bookingDate) { setError('يجب تحديد التاريخ'); return; }
      if (startTime >= endTime) { setError('وقت الانتهاء يجب أن يكون بعد وقت البدء'); return; }
      if (recurrenceType === 'recurring') {
        if (repeatEndType === 'count' && (repeatCount < 2 || repeatCount > 52)) {
          setError('عدد مرات التكرار يجب أن يكون بين 2 و52'); return;
        }
        if (repeatEndType === 'date' && !repeatUntil) {
          setError('يجب تحديد تاريخ نهاية التكرار'); return;
        }
        if (repeatEndType === 'date' && repeatUntil < bookingDate) {
          setError('تاريخ نهاية التكرار يجب أن يكون بعد أو نفس تاريخ أول حجز'); return;
        }
      }
    } else {
      // Validate retreat
      if (!checkInDate)  { setError('يجب تحديد تاريخ الوصول'); return; }
      if (!checkOutDate) { setError('يجب تحديد تاريخ المغادرة'); return; }
      if (checkOutDate <= checkInDate) { setError('تاريخ المغادرة يجب أن يكون بعد تاريخ الوصول'); return; }
    }

    setIsSubmitting(true);

    // ── ONE DAY ───────────────────────────────────────────────────────────
    if (aboType === 'one_day') {
      const isRecurring = recurrenceType === 'recurring';
      const occurrenceDates = isRecurring
        ? generateOccurrenceDates(
            bookingDate, repeatInterval, repeatEndType,
            repeatEndType === 'count' ? repeatCount : 999, repeatUntil
          )
        : [bookingDate];

      // Check availability for all occurrences
      const conflicts = [];
      for (const occDate of occurrenceDates) {
        const { data: avail, error: rpcErr } = await supabase.rpc('check_abo_talat_availability', {
          p_booking_type: 'one_day',
          p_date:         occDate,
          p_start_time:   startTime,
          p_end_time:     endTime,
          p_exclude_id:   null,
        });
        if (rpcErr) {
          setError('حدث خطأ أثناء التحقق من التوفر، يرجى المحاولة مرة أخرى');
          setIsSubmitting(false); return;
        }
        if (avail === false) conflicts.push(occDate);
      }

      if (conflicts.length > 0) {
        setError('بيت أبوتلات غير متاح في هذا الموعد');
        setUnavailableDates(conflicts);
        setIsSubmitting(false); return;
      }

      // Insert all occurrences
      const groupId = isRecurring ? crypto.randomUUID() : null;
      const totalOcc = occurrenceDates.length;

      const rows = occurrenceDates.map((occDate, idx) => ({
        requester_name:        form.requester_name,
        service_name:          form.service_name,
        phone:                 form.phone,
        notes:                 form.notes || null,
        status:                'pending',
        booking_category:      'abo_talat',
        abo_talat_booking_type: 'one_day',
        booking_date:          occDate,
        start_time:            startTime,
        end_time:              endTime,
        facilities:            selectedFacilities.length > 0 ? selectedFacilities : null,
        ...(isRecurring ? {
          recurrence_group_id: groupId,
          recurrence_type:     repeatInterval,
          recurrence_count:    repeatEndType === 'count' ? repeatCount : null,
          recurrence_until:    repeatEndType === 'date'  ? repeatUntil  : null,
          occurrence_number:   idx + 1,
          total_occurrences:   totalOcc,
        } : {}),
      }));

      const { error: insertErr } = await supabase.from('booking_requests').insert(rows);
      if (insertErr) {
        setError('حدث خطأ أثناء إرسال الطلب، يرجى المحاولة مرة أخرى');
        setIsSubmitting(false); return;
      }

      sendAboTalatEmail({
        requester_name:          form.requester_name,
        service_name:            form.service_name,
        phone:                   form.phone,
        notes:                   form.notes || '',
        booking_category:        'abo_talat',
        abo_talat_booking_type:  'one_day',
        booking_date:            bookingDate,
        start_time:              startTime,
        end_time:                endTime,
        facilities:              selectedFacilities,
        is_recurring:            isRecurring,
        recurrence_type:         repeatInterval,
        recurrence_count:        totalOcc,
        occurrence_dates:        occurrenceDates,
      }).catch(console.error);

      setSuccessCount(totalOcc);
      setSuccess(true);
      setIsSubmitting(false);
      resetForm();
      return;
    }

    // ── RETREAT ───────────────────────────────────────────────────────────
    const { data: avail, error: rpcErr } = await supabase.rpc('check_abo_talat_availability', {
      p_booking_type:     'retreat',
      p_check_in_date:    checkInDate,
      p_check_out_date:   checkOutDate,
      p_check_out_period: checkOutPeriod,  // 'morning' | 'evening'
      p_exclude_id:       null,
    });
    if (rpcErr) {
      setError('حدث خطأ أثناء التحقق من التوفر، يرجى المحاولة مرة أخرى');
      setIsSubmitting(false); return;
    }
    if (avail === false) {
      setError('بيت أبوتلات غير متاح في هذا الموعد');
      setIsSubmitting(false); return;
    }

    const { error: insertErr } = await supabase.from('booking_requests').insert({
      requester_name:          form.requester_name,
      service_name:            form.service_name,
      phone:                   form.phone,
      notes:                   form.notes || null,
      status:                  'pending',
      booking_category:        'abo_talat',
      abo_talat_booking_type:  'retreat',
      check_in_date:           checkInDate,
      check_out_date:          checkOutDate,
      check_out_period:        checkOutPeriod,
      facilities:              selectedFacilities.length > 0 ? selectedFacilities : null,
      // Legacy compatibility — these columns are NOT NULL in the DB schema.
      // For retreats, booking_date/start_time/end_time are placeholder values only.
      // All real retreat date logic uses check_in_date / check_out_date.
      booking_date:            checkInDate,
      start_time:              '00:00',
      end_time:                '23:59',
    });

    if (insertErr) {
      setError('حدث خطأ أثناء إرسال الطلب، يرجى المحاولة مرة أخرى');
      setIsSubmitting(false); return;
    }

    sendAboTalatEmail({
      requester_name:          form.requester_name,
      service_name:            form.service_name,
      phone:                   form.phone,
      notes:                   form.notes || '',
      booking_category:        'abo_talat',
      abo_talat_booking_type:  'retreat',
      check_in_date:           checkInDate,
      check_out_date:          checkOutDate,
      check_out_period:        checkOutPeriod,
      facilities:              selectedFacilities,
    }).catch(console.error);

    setSuccessCount(1);
    setSuccess(true);
    setIsSubmitting(false);
    resetForm();
  };

  function resetForm() {
    setForm({ requester_name: '', service_name: '', phone: '', notes: '' });
    setAboType('one_day');
    setBookingDate(''); setStartTime('18:00'); setEndTime('20:00');
    setCheckInDate(''); setCheckOutDate(''); setCheckOutPeriod('morning');
    setSelectedFacilities([]);
    setRecurrenceType('once'); setRepeatInterval('weekly');
    setRepeatEndType('count'); setRepeatCount(4); setRepeatUntil('');
  }

  // ── Success screen ────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="max-w-2xl mx-auto mt-6 p-6 sm:p-8 bg-white rounded-2xl shadow-sm border border-green-100 text-center space-y-6">
        <CheckCircle2 className="w-16 h-16 sm:w-20 sm:h-20 text-green-500 mx-auto" />
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">تم الإرسال بنجاح</h2>
        <p className="text-lg sm:text-xl text-gray-600">
          {successCount > 1
            ? <>تم إرسال <span className="font-bold text-[#8B0000]">{successCount}</span> طلب حجز متكرر لبيت أبوتلات، في انتظار موافقة المسؤول</>
            : 'تم إرسال طلب الحجز بنجاح، في انتظار موافقة المسؤول'
          }
        </p>
        <button
          onClick={() => setSuccess(false)}
          className="w-full sm:w-auto mt-4 px-6 py-3 bg-[#8B0000] text-white rounded-lg font-semibold hover:bg-red-900 transition-colors"
        >
          إرسال طلب آخر
        </button>
      </div>
    );
  }

  const isRecurring = recurrenceType === 'recurring';

  if (view === 'calendar') {
    return (
      <div className="pt-2">
        <AboTalatCalendarView 
          onDateSelect={setSelectedDateFromCalendar}
          onBookClick={() => setView('form')}
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Page header */}
      <div className="bg-[#8B0000] p-4 sm:p-6 text-white text-center">
        <div className="flex items-center justify-center gap-3 mb-1">
          <Building2 className="w-6 h-6 sm:w-7 sm:h-7" />
          <h2 className="text-xl sm:text-2xl font-bold">نموذج طلب حجز بيت أبوتلات</h2>
        </div>
        <p className="text-sm text-red-200">كنيسة مارجرجس سيدي بشر</p>
      </div>

      <form onSubmit={handleSubmit} className="p-4 sm:p-6 lg:p-8 space-y-5">

        {/* Back to calendar button */}
        <div className="flex justify-start mb-2">
          <button 
            type="button" 
            onClick={() => setView('calendar')}
            className="text-sm font-bold text-gray-600 hover:text-[#8B0000] underline underline-offset-4"
          >
            &rarr; رجوع إلى جدول الإتاحة
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
            <div className="flex items-start gap-3 text-red-700">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span className="font-semibold text-base leading-snug">{error}</span>
            </div>
            {unavailableDates.length > 0 && (
              <ul className="mt-3 space-y-1">
                {unavailableDates.map((d, i) => (
                  <li key={i} className="bg-red-100 rounded-lg px-3 py-1.5 text-red-800 font-bold text-sm">
                    📅 {formatDateAr(d)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Name + Phone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">الاسم</label>
            <input type="text" name="requester_name" required
              value={form.requester_name} onChange={handleChange}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#8B0000] outline-none"
              placeholder="اسم مقدم الطلب" />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">رقم الهاتف</label>
            <input type="tel" name="phone" required
              value={form.phone} onChange={handleChange}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#8B0000] outline-none"
              placeholder="01xxxxxxxxx" dir="ltr" />
          </div>
        </div>

        {/* Service */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">الخدمة / الاجتماع</label>
          <input type="text" name="service_name" required
            value={form.service_name} onChange={handleChange}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#8B0000] outline-none"
            placeholder="اسم الخدمة أو الاجتماع" />
        </div>

        {/* ── Booking type ─────────────────────────────────────────────────── */}
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
            <label className="block text-base font-bold text-gray-800">نوع الحجز</label>
          </div>
          <div className="p-4 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* يوم واحد */}
              <label className={`flex items-center gap-3 flex-1 p-3 rounded-lg border-2 cursor-pointer transition-colors ${aboType === 'one_day' ? 'border-[#8B0000] bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <input type="radio" name="aboType" value="one_day"
                  checked={aboType === 'one_day'}
                  onChange={() => { setAboType('one_day'); clearError(); }}
                  className="w-4 h-4 text-[#8B0000] focus:ring-[#8B0000]" />
                <div>
                  <p className="font-bold text-sm text-gray-900">يوم واحد</p>
                  <p className="text-xs text-gray-500">حجز لساعات محددة في يوم واحد</p>
                </div>
              </label>
              {/* خلوة */}
              <label className={`flex items-center gap-3 flex-1 p-3 rounded-lg border-2 cursor-pointer transition-colors ${aboType === 'retreat' ? 'border-[#8B0000] bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <input type="radio" name="aboType" value="retreat"
                  checked={aboType === 'retreat'}
                  onChange={() => { setAboType('retreat'); setRecurrenceType('once'); clearError(); }}
                  className="w-4 h-4 text-[#8B0000] focus:ring-[#8B0000]" />
                <div>
                  <p className="font-bold text-sm text-gray-900">خلوة</p>
                  <p className="text-xs text-gray-500">إقامة لأكثر من يوم</p>
                </div>
              </label>
            </div>

            {/* ── يوم واحد: date + time ──────────────────────────────────── */}
            {aboType === 'one_day' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">التاريخ</label>
                    <input type="date" required
                      value={bookingDate}
                      onChange={(e) => { setBookingDate(e.target.value); clearError(); }}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#8B0000] outline-none" />
                  </div>
                  <ArabicTimePicker id="abo_start_time" label="من الساعة"
                    value={startTime}
                    onChange={(v) => { setStartTime(v); clearError(); }}
                    required />
                  <ArabicTimePicker id="abo_end_time" label="إلى الساعة"
                    value={endTime}
                    onChange={(v) => { setEndTime(v); clearError(); }}
                    required />
                </div>

                {/* Time preview */}
                {startTime && endTime && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-800 font-semibold text-center">
                    سيتم الحجز من{' '}
                    <span className="text-[#8B0000] font-bold">{formatArabic12(startTime)}</span>
                    {' '}إلى{' '}
                    <span className="text-[#8B0000] font-bold">{formatArabic12(endTime)}</span>
                  </div>
                )}

                {/* ── Recurrence section (one_day only) ─────────────────── */}
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                    <label className="block text-sm font-bold text-gray-800">نوع الحجز الزمني</label>
                  </div>
                  <div className="p-4 space-y-4">
                    <div className="flex flex-col sm:flex-row gap-3">
                      <label className={`flex items-center gap-3 flex-1 p-3 rounded-lg border-2 cursor-pointer transition-colors ${recurrenceType === 'once' ? 'border-[#8B0000] bg-red-50' : 'border-gray-200'}`}>
                        <input type="radio" name="recurrenceType" value="once"
                          checked={recurrenceType === 'once'}
                          onChange={() => { setRecurrenceType('once'); clearError(); }}
                          className="w-4 h-4 text-[#8B0000] focus:ring-[#8B0000]" />
                        <div>
                          <p className="font-bold text-sm text-gray-900">حجز مرة واحدة</p>
                          <p className="text-xs text-gray-500">ليوم واحد فقط</p>
                        </div>
                      </label>
                      <label className={`flex items-center gap-3 flex-1 p-3 rounded-lg border-2 cursor-pointer transition-colors ${recurrenceType === 'recurring' ? 'border-[#8B0000] bg-red-50' : 'border-gray-200'}`}>
                        <input type="radio" name="recurrenceType" value="recurring"
                          checked={recurrenceType === 'recurring'}
                          onChange={() => { setRecurrenceType('recurring'); clearError(); }}
                          className="w-4 h-4 text-[#8B0000] focus:ring-[#8B0000]" />
                        <div>
                          <p className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
                            <RefreshCw className="w-3.5 h-3.5 text-[#8B0000]" />حجز متكرر
                          </p>
                          <p className="text-xs text-gray-500">أسبوعيًا أو شهريًا</p>
                        </div>
                      </label>
                    </div>

                    {isRecurring && (
                      <div className="space-y-4">
                        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-amber-700 font-medium">سيتم إرسال طلب حجز متكرر، وسيحتاج إلى موافقة المسؤول</p>
                        </div>

                        {/* Interval */}
                        <div className="space-y-2">
                          <label className="block text-sm font-semibold text-gray-700">نوع التكرار</label>
                          <div className="flex gap-3">
                            {[['weekly','أسبوعيًا'],['monthly','شهريًا']].map(([val, lbl]) => (
                              <label key={val} className={`flex items-center gap-2 flex-1 p-3 rounded-lg border cursor-pointer transition-colors ${repeatInterval === val ? 'border-[#8B0000] bg-red-50' : 'border-gray-200'}`}>
                                <input type="radio" name="repeatInterval" value={val}
                                  checked={repeatInterval === val}
                                  onChange={() => setRepeatInterval(val)}
                                  className="w-4 h-4 text-[#8B0000] focus:ring-[#8B0000]" />
                                <span className="text-sm font-semibold text-gray-800">{lbl}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        {/* End type */}
                        <div className="space-y-2">
                          <label className="block text-sm font-semibold text-gray-700">نهاية التكرار</label>
                          <div className="space-y-2">
                            <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${repeatEndType === 'count' ? 'border-[#8B0000] bg-red-50' : 'border-gray-200'}`}>
                              <input type="radio" name="repeatEndType" value="count"
                                checked={repeatEndType === 'count'}
                                onChange={() => setRepeatEndType('count')}
                                className="w-4 h-4 text-[#8B0000] focus:ring-[#8B0000] flex-shrink-0" />
                              <span className="text-sm font-semibold text-gray-800 flex-shrink-0">عدد المرات:</span>
                              <input type="number" min="2" max="52" value={repeatCount}
                                onChange={(e) => setRepeatCount(Math.max(2, Math.min(52, parseInt(e.target.value) || 2)))}
                                disabled={repeatEndType !== 'count'}
                                onClick={(ev) => { setRepeatEndType('count'); }}
                                className="w-20 px-3 py-1.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#8B0000] outline-none text-sm font-bold text-center disabled:opacity-40"
                                dir="ltr" />
                              <span className="text-sm text-gray-500">مرة</span>
                            </label>
                            <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${repeatEndType === 'date' ? 'border-[#8B0000] bg-red-50' : 'border-gray-200'}`}>
                              <input type="radio" name="repeatEndType" value="date"
                                checked={repeatEndType === 'date'}
                                onChange={() => setRepeatEndType('date')}
                                className="w-4 h-4 text-[#8B0000] focus:ring-[#8B0000] flex-shrink-0" />
                              <span className="text-sm font-semibold text-gray-800 flex-shrink-0">حتى تاريخ:</span>
                              <input type="date" value={repeatUntil}
                                min={bookingDate || undefined}
                                onChange={(e) => setRepeatUntil(e.target.value)}
                                disabled={repeatEndType !== 'date'}
                                onClick={(ev) => { 
                                  setRepeatEndType('date'); 
                                  try { if (ev.target.showPicker) ev.target.showPicker(); } catch (e) {} 
                                }}
                                className="flex-1 px-3 py-1.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#8B0000] outline-none text-sm disabled:opacity-40" />
                            </label>
                          </div>
                        </div>

                        {/* Date preview */}
                        {bookingDate && (
                          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 space-y-1.5">
                            <div className="flex items-center gap-2 text-blue-700 font-bold text-sm">
                              <Calendar className="w-4 h-4" />مواعيد الحجز المتكرر
                            </div>
                            {(() => {
                              const dates = generateOccurrenceDates(
                                bookingDate, repeatInterval, repeatEndType,
                                repeatEndType === 'count' ? repeatCount : 999, repeatUntil
                              ).slice(0, 12);
                              const total = repeatEndType === 'count' ? repeatCount :
                                generateOccurrenceDates(bookingDate, repeatInterval, 'date', 999, repeatUntil).length;
                              return (
                                <>
                                  <div className="flex flex-wrap gap-1.5 mt-1">
                                    {dates.map((d, i) => (
                                      <span key={i} className="bg-white border border-blue-200 text-blue-800 text-xs font-semibold px-2 py-1 rounded-lg">
                                        {formatDateAr(d)}
                                      </span>
                                    ))}
                                    {total > 12 && (
                                      <span className="bg-blue-100 text-blue-600 text-xs font-semibold px-2 py-1 rounded-lg">+{total - 12} أخرى</span>
                                    )}
                                  </div>
                                  <p className="text-xs text-blue-600 font-medium">إجمالي: {repeatEndType === 'count' ? repeatCount : total} مرة</p>
                                </>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── خلوة: date range + check-out period ───────────────────── */}
            {aboType === 'retreat' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">تاريخ الوصول</label>
                    <input type="date" required
                      value={checkInDate}
                      onChange={(e) => { setCheckInDate(e.target.value); clearError(); }}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#8B0000] outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">تاريخ المغادرة</label>
                    <input type="date" required
                      min={checkInDate || undefined}
                      value={checkOutDate}
                      onChange={(e) => { setCheckOutDate(e.target.value); clearError(); }}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#8B0000] outline-none" />
                  </div>
                </div>

                {/* Check-out period */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">وقت المغادرة</label>
                  <div className="flex gap-3">
                    {[['morning','صباحًا'],['evening','مساءً']].map(([val, lbl]) => (
                      <label key={val} className={`flex items-center gap-2 flex-1 p-3 rounded-lg border cursor-pointer transition-colors ${checkOutPeriod === val ? 'border-[#8B0000] bg-red-50' : 'border-gray-200'}`}>
                        <input type="radio" name="checkOutPeriod" value={val}
                          checked={checkOutPeriod === val}
                          onChange={() => setCheckOutPeriod(val)}
                          className="w-4 h-4 text-[#8B0000] focus:ring-[#8B0000]" />
                        <span className="text-sm font-semibold text-gray-800">{lbl}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Date range preview */}
                {checkInDate && checkOutDate && checkOutDate > checkInDate && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-800 font-semibold text-center">
                    من{' '}
                    <span className="text-[#8B0000] font-bold">{formatDateAr(checkInDate)}</span>
                    {' '}إلى{' '}
                    <span className="text-[#8B0000] font-bold">{formatDateAr(checkOutDate)}</span>
                    {' '} — مغادرة{' '}
                    <span className="text-[#8B0000] font-bold">{checkOutPeriod === 'morning' ? 'صباحًا' : 'مساءً'}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Facilities ────────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <label className="block text-base sm:text-lg font-bold text-[#8B0000]">المرافق المطلوبة</label>
            {selectedFacilities.length > 0 && (
              <span className="bg-red-50 text-[#8B0000] px-3 py-1 rounded-full text-sm font-bold border border-red-100 flex-shrink-0">
                عدد المرافق المختارة: {selectedFacilities.length}
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {FACILITIES.map(({ id, label, icon: Icon }) => {
              const selected = selectedFacilities.includes(id);
              return (
                <label key={id}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                    selected ? 'border-[#8B0000] bg-red-50' : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <input type="checkbox"
                    className="w-5 h-5 flex-shrink-0 text-[#8B0000] rounded focus:ring-[#8B0000]"
                    checked={selected}
                    onChange={() => toggleFacility(id)} />
                  <Icon className={`w-5 h-5 flex-shrink-0 ${selected ? 'text-[#8B0000]' : 'text-gray-500'}`} />
                  <span className={`font-bold text-sm ${selected ? 'text-[#8B0000]' : 'text-gray-800'}`}>{label}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">ملاحظات (اختياري)</label>
          <textarea name="notes" value={form.notes} onChange={handleChange} rows={3}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#8B0000] outline-none resize-none"
            placeholder="أي ملاحظات إضافية..." />
        </div>

        {/* Submit */}
        <button type="submit" disabled={isSubmitting}
          className="w-full flex items-center justify-center gap-2 bg-[#8B0000] text-white py-4 rounded-xl text-base sm:text-lg font-bold hover:bg-red-900 transition-colors disabled:opacity-70">
          {isSubmitting ? (
            <><Loader2 className="w-5 h-5 animate-spin" />جارٍ الإرسال...</>
          ) : isRecurring ? (
            <><RefreshCw className="w-5 h-5" />إرسال طلب الحجز المتكرر</>
          ) : (
            <><Send className="w-5 h-5" />إرسال طلب الحجز</>
          )}
        </button>
      </form>
    </div>
  );
}
