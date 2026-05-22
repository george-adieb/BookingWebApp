import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Send, CheckCircle2, AlertCircle, Loader2, RefreshCw, Calendar } from 'lucide-react';
import ArabicTimePicker, { formatArabic12 } from '../components/ArabicTimePicker';

// ── Email notification (fire-and-forget) ─────────────────────────────────────
const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function sendBookingEmail(payload) {
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
    console.error('[sendBookingEmail] Failed to send email notification:', err);
  }
}

// ── Date helpers ──────────────────────────────────────────────────────────────
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
  // Clamp to last day of month if needed
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
    // end by date
    let i = 1;
    while (true) {
      const next = interval === 'weekly' ? addWeeks(baseDate, i) : addMonths(baseDate, i);
      if (next > untilDate) break;
      dates.push(next);
      i++;
      if (i > 365) break; // safety cap
    }
  }
  return dates;
}

// ── Arabic date formatter ─────────────────────────────────────────────────────
function formatDateAr(dateStr) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('ar-EG', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch { return dateStr; }
}

export default function BookingRequestPage() {
  const [searchParams] = useSearchParams();
  const preSelectedPlaceId = searchParams.get('placeId') || '';
  const preSelectedDate    = searchParams.get('date')    || '';

  const [places, setPlaces]     = useState([]);
  const [placesLoading, setPlacesLoading] = useState(true);

  // ── Core booking fields ────────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    requester_name: '',
    service_name:   '',
    phone:          '',
    place_ids:      preSelectedPlaceId ? [preSelectedPlaceId] : [],
    booking_date:   preSelectedDate,
    start_time:     '18:00',
    end_time:       '20:00',
    notes:          '',
  });

  // ── Recurrence fields ──────────────────────────────────────────────────────
  const [recurrenceType, setRecurrenceType] = useState('once');   // 'once' | 'recurring'
  const [repeatInterval, setRepeatInterval] = useState('weekly'); // 'weekly' | 'monthly'
  const [repeatEndType, setRepeatEndType]   = useState('count');  // 'count' | 'date'
  const [repeatCount, setRepeatCount]       = useState(4);
  const [repeatUntil, setRepeatUntil]       = useState('');

  const [error, setError]                           = useState('');
  const [unavailableDetails, setUnavailableDetails] = useState([]); // [{date, places:[]}]
  const [success, setSuccess]                       = useState(false);
  const [successIsRecurring, setSuccessIsRecurring] = useState(false);
  const [successCount, setSuccessCount]             = useState(0);
  const [isSubmitting, setIsSubmitting]             = useState(false);

  useEffect(() => {
    supabase.from('places').select('id, building, floor, name').eq('is_active', true)
      .order('building').then(({ data, error: e }) => {
        if (!e && data) setPlaces(data);
        setPlacesLoading(false);
      });
  }, []);

  const buildings = [...new Set(places.map((p) => p.building))];

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError(''); setUnavailableDetails([]);
  };

  const handlePlaceToggle = (placeId) => {
    setFormData((prev) => ({
      ...prev,
      place_ids: prev.place_ids.includes(placeId)
        ? prev.place_ids.filter((id) => id !== placeId)
        : [...prev.place_ids, placeId],
    }));
    setError(''); setUnavailableDetails([]);
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setUnavailableDetails([]);

    if (formData.place_ids.length === 0) { setError('يجب اختيار مكان واحد على الأقل'); return; }
    if (formData.start_time >= formData.end_time) { setError('وقت الانتهاء يجب أن يكون بعد وقت البدء'); return; }
    if (!formData.booking_date) { setError('يجب تحديد تاريخ الحجز'); return; }

    // Recurring-specific validation
    if (recurrenceType === 'recurring') {
      if (repeatEndType === 'count' && (repeatCount < 2 || repeatCount > 52)) {
        setError('عدد مرات التكرار يجب أن يكون بين 2 و52');
        return;
      }
      if (repeatEndType === 'date' && !repeatUntil) {
        setError('يجب تحديد تاريخ نهاية التكرار');
        return;
      }
      if (repeatEndType === 'date' && repeatUntil <= formData.booking_date) {
        setError('تاريخ نهاية التكرار يجب أن يكون بعد تاريخ الحجز');
        return;
      }
    }

    setIsSubmitting(true);

    // ── ONE-TIME BOOKING ────────────────────────────────────────────────────
    if (recurrenceType === 'once') {
      const conflicts = [];
      let rpcFailed = false;

      for (const placeId of formData.place_ids) {
        const { data: isAvailable, error: rpcError } = await supabase.rpc('check_place_availability', {
          p_place_id:   placeId,
          p_date:       formData.booking_date,
          p_start_time: formData.start_time,
          p_end_time:   formData.end_time,
          p_exclude_id: null,
        });

        if (rpcError) { rpcFailed = true; break; }
        if (isAvailable === false) {
          const place = places.find((p) => p.id === placeId);
          if (place) conflicts.push(`${place.building} - ${place.floor} - ${place.name}`);
        }
      }

      if (rpcFailed) {
        setError('حدث خطأ أثناء التحقق من توفر الأماكن، يرجى المحاولة مرة أخرى');
        setIsSubmitting(false); return;
      }
      if (conflicts.length > 0) {
        setError('بعض الأماكن المختارة غير متاحة في هذا الوقت');
        setUnavailableDetails([{ date: formData.booking_date, places: conflicts }]);
        setIsSubmitting(false); return;
      }

      const { data: newRequest, error: insertError } = await supabase
        .from('booking_requests')
        .insert({
          requester_name: formData.requester_name,
          service_name:   formData.service_name,
          phone:          formData.phone,
          booking_date:   formData.booking_date,
          start_time:     formData.start_time,
          end_time:       formData.end_time,
          notes:          formData.notes || null,
          status:         'pending',
          // recurrence columns remain NULL for one-time bookings
        })
        .select('id')
        .single();

      if (insertError || !newRequest) {
        setError('حدث خطأ أثناء إرسال الطلب، يرجى المحاولة مرة أخرى');
        setIsSubmitting(false); return;
      }

      const placeRows = formData.place_ids.map((pid) => ({
        booking_request_id: newRequest.id,
        place_id:           pid,
      }));
      const { error: placesInsertError } = await supabase.from('booking_request_places').insert(placeRows);

      if (placesInsertError) {
        setError('تم إنشاء الطلب ولكن حدث خطأ في ربط الأماكن، يرجى التواصل مع المسؤول');
        setIsSubmitting(false); return;
      }

      const selectedPlaces = formData.place_ids
        .map((id) => places.find((p) => p.id === id))
        .filter(Boolean);

      sendBookingEmail({
        requester_name: formData.requester_name,
        service_name:   formData.service_name,
        phone:          formData.phone,
        booking_date:   formData.booking_date,
        start_time:     formData.start_time,
        end_time:       formData.end_time,
        places:         selectedPlaces.map((p) => ({ building: p.building, floor: p.floor, name: p.name })),
        notes:          formData.notes || '',
        is_recurring:   false,
      }).catch((err) => console.error('[sendBookingEmail] Unhandled promise rejection:', err));

      setSuccess(true);
      setSuccessIsRecurring(false);
      setSuccessCount(1);
      setIsSubmitting(false);
      resetForm();
      return;
    }

    // ── RECURRING BOOKING ───────────────────────────────────────────────────
    const occurrenceDates = generateOccurrenceDates(
      formData.booking_date,
      repeatInterval,
      repeatEndType,
      repeatEndType === 'count' ? repeatCount : 999,
      repeatUntil,
    );

    if (occurrenceDates.length < 2) {
      setError('لم يتم توليد مواعيد متكررة كافية، يرجى مراجعة إعدادات التكرار');
      setIsSubmitting(false); return;
    }

    // Check availability for all occurrences × all places
    const conflictsByDate = [];
    let rpcFailed = false;

    for (const occDate of occurrenceDates) {
      const conflictsForDate = [];
      for (const placeId of formData.place_ids) {
        const { data: isAvailable, error: rpcError } = await supabase.rpc('check_place_availability', {
          p_place_id:   placeId,
          p_date:       occDate,
          p_start_time: formData.start_time,
          p_end_time:   formData.end_time,
          p_exclude_id: null,
        });

        if (rpcError) { rpcFailed = true; break; }
        if (isAvailable === false) {
          const place = places.find((p) => p.id === placeId);
          if (place) conflictsForDate.push(`${place.building} - ${place.floor} - ${place.name}`);
        }
      }
      if (rpcFailed) break;
      if (conflictsForDate.length > 0) {
        conflictsByDate.push({ date: occDate, places: conflictsForDate });
      }
    }

    if (rpcFailed) {
      setError('حدث خطأ أثناء التحقق من توفر الأماكن، يرجى المحاولة مرة أخرى');
      setIsSubmitting(false); return;
    }
    if (conflictsByDate.length > 0) {
      setError('بعض المواعيد المتكررة غير متاحة');
      setUnavailableDetails(conflictsByDate);
      setIsSubmitting(false); return;
    }

    // All clear — insert all occurrences
    const groupId = crypto.randomUUID();
    const totalOcc = occurrenceDates.length;

    const rows = occurrenceDates.map((occDate, idx) => ({
      requester_name:      formData.requester_name,
      service_name:        formData.service_name,
      phone:               formData.phone,
      booking_date:        occDate,
      start_time:          formData.start_time,
      end_time:            formData.end_time,
      notes:               formData.notes || null,
      status:              'pending',
      recurrence_group_id: groupId,
      recurrence_type:     repeatInterval,
      recurrence_count:    repeatEndType === 'count' ? repeatCount : null,
      recurrence_until:    repeatEndType === 'date'  ? repeatUntil  : null,
      occurrence_number:   idx + 1,
      total_occurrences:   totalOcc,
    }));

    const { data: insertedRows, error: insertError } = await supabase
      .from('booking_requests')
      .insert(rows)
      .select('id');

    if (insertError || !insertedRows || insertedRows.length !== totalOcc) {
      setError('حدث خطأ أثناء إنشاء الحجوزات المتكررة، يرجى المحاولة مرة أخرى');
      setIsSubmitting(false); return;
    }

    // Insert places for each occurrence
    const allPlaceRows = insertedRows.flatMap((row) =>
      formData.place_ids.map((pid) => ({
        booking_request_id: row.id,
        place_id:           pid,
      }))
    );
    const { error: placesInsertError } = await supabase.from('booking_request_places').insert(allPlaceRows);

    if (placesInsertError) {
      setError('تم إنشاء الطلبات ولكن حدث خطأ في ربط الأماكن، يرجى التواصل مع المسؤول');
      setIsSubmitting(false); return;
    }

    // Fire email (once, summarising all occurrences)
    const selectedPlaces = formData.place_ids
      .map((id) => places.find((p) => p.id === id))
      .filter(Boolean);

    sendBookingEmail({
      requester_name:    formData.requester_name,
      service_name:      formData.service_name,
      phone:             formData.phone,
      booking_date:      formData.booking_date,
      start_time:        formData.start_time,
      end_time:          formData.end_time,
      places:            selectedPlaces.map((p) => ({ building: p.building, floor: p.floor, name: p.name })),
      notes:             formData.notes || '',
      is_recurring:      true,
      recurrence_type:   repeatInterval,
      recurrence_count:  totalOcc,
      occurrence_dates:  occurrenceDates,
    }).catch((err) => console.error('[sendBookingEmail] Unhandled promise rejection:', err));

    setSuccess(true);
    setSuccessIsRecurring(true);
    setSuccessCount(totalOcc);
    setIsSubmitting(false);
    resetForm();
  };

  function resetForm() {
    setFormData({
      requester_name: '', service_name: '', phone: '', place_ids: [],
      booking_date: '', start_time: '18:00', end_time: '20:00', notes: '',
    });
    setRecurrenceType('once');
    setRepeatInterval('weekly');
    setRepeatEndType('count');
    setRepeatCount(4);
    setRepeatUntil('');
  }

  // ── Success screen ────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="max-w-2xl mx-auto mt-6 p-6 sm:p-8 bg-white rounded-2xl shadow-sm border border-green-100 text-center space-y-6">
        <CheckCircle2 className="w-16 h-16 sm:w-20 sm:h-20 text-green-500 mx-auto" />
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">تم الإرسال بنجاح</h2>
        {successIsRecurring ? (
          <p className="text-lg sm:text-xl text-gray-600">
            تم إرسال <span className="font-bold text-[#8B0000]">{successCount}</span> طلب حجز متكرر بنجاح، في انتظار موافقة المسؤول
          </p>
        ) : (
          <p className="text-lg sm:text-xl text-gray-600">تم إرسال طلب الحجز بنجاح، في انتظار موافقة المسؤول</p>
        )}
        <button
          onClick={() => setSuccess(false)}
          className="w-full sm:w-auto mt-4 px-6 py-3 bg-[#8B0000] text-white rounded-lg font-semibold hover:bg-red-900 transition-colors"
        >
          إرسال طلب آخر
        </button>
      </div>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  const isRecurring = recurrenceType === 'recurring';

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Page header bar */}
      <div className="bg-[#8B0000] p-4 sm:p-6 text-white text-center">
        <h2 className="text-xl sm:text-2xl font-bold">نموذج طلب حجز الأماكن</h2>
      </div>

      <form onSubmit={handleSubmit} className="p-4 sm:p-6 lg:p-8 space-y-5">
        {/* Error banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
            <div className="flex items-start gap-3 text-red-700">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span className="font-semibold text-base leading-snug">{error}</span>
            </div>
            {unavailableDetails.length > 0 && (
              <div className="mt-3 space-y-3">
                {unavailableDetails.map((item, i) => (
                  <div key={i} className="bg-red-100 rounded-lg px-3 py-2">
                    <p className="text-red-800 font-bold text-sm mb-1">
                      📅 {formatDateAr(item.date)}
                    </p>
                    <ul className="list-disc list-inside text-red-600 text-sm space-y-0.5">
                      {item.places.map((place, j) => (
                        <li key={j} className="mr-4">{place}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Row 1: Name + Phone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">الاسم</label>
            <input
              type="text" name="requester_name" required
              value={formData.requester_name} onChange={handleChange}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#8B0000] outline-none"
              placeholder="اسم مقدم الطلب"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">رقم الهاتف</label>
            <input
              type="tel" name="phone" required
              value={formData.phone} onChange={handleChange}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#8B0000] outline-none"
              placeholder="01xxxxxxxxx" dir="ltr"
            />
          </div>
        </div>

        {/* Row 2: Service */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">الخدمة / الاجتماع</label>
          <input
            type="text" name="service_name" required
            value={formData.service_name} onChange={handleChange}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#8B0000] outline-none"
            placeholder="اسم الخدمة أو الاجتماع"
          />
        </div>

        {/* Row 3: Date + Time */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">التاريخ</label>
            <input
              type="date" name="booking_date" required
              value={formData.booking_date} onChange={handleChange}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#8B0000] outline-none"
            />
          </div>
          <ArabicTimePicker
            id="start_time"
            label="من الساعة"
            value={formData.start_time}
            onChange={(v) => { setFormData((p) => ({ ...p, start_time: v })); setError(''); }}
            required
          />
          <ArabicTimePicker
            id="end_time"
            label="إلى الساعة"
            value={formData.end_time}
            onChange={(v) => { setFormData((p) => ({ ...p, end_time: v })); setError(''); }}
            required
          />
        </div>

        {/* Time preview */}
        {formData.start_time && formData.end_time && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-800 font-semibold text-center">
            سيتم الحجز من{' '}
            <span className="text-[#8B0000] font-bold">{formatArabic12(formData.start_time)}</span>
            {' '}إلى{' '}
            <span className="text-[#8B0000] font-bold">{formatArabic12(formData.end_time)}</span>
          </div>
        )}

        {/* ── Recurrence Section ──────────────────────────────────────── */}
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          {/* Section header */}
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
            <label className="block text-base font-bold text-gray-800">نوع الحجز</label>
          </div>
          <div className="p-4 space-y-4">
            {/* Type selector */}
            <div className="flex flex-col sm:flex-row gap-3">
              <label
                className={`flex items-center gap-3 flex-1 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                  recurrenceType === 'once'
                    ? 'border-[#8B0000] bg-red-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="recurrenceType"
                  value="once"
                  checked={recurrenceType === 'once'}
                  onChange={() => { setRecurrenceType('once'); setError(''); setUnavailableDetails([]); }}
                  className="w-4 h-4 text-[#8B0000] focus:ring-[#8B0000]"
                />
                <div>
                  <p className="font-bold text-sm text-gray-900">حجز مرة واحدة</p>
                  <p className="text-xs text-gray-500">حجز عادي لمرة واحدة فقط</p>
                </div>
              </label>
              <label
                className={`flex items-center gap-3 flex-1 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                  recurrenceType === 'recurring'
                    ? 'border-[#8B0000] bg-red-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="recurrenceType"
                  value="recurring"
                  checked={recurrenceType === 'recurring'}
                  onChange={() => { setRecurrenceType('recurring'); setError(''); setUnavailableDetails([]); }}
                  className="w-4 h-4 text-[#8B0000] focus:ring-[#8B0000]"
                />
                <div>
                  <p className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 text-[#8B0000]" />
                    حجز متكرر
                  </p>
                  <p className="text-xs text-gray-500">يتكرر أسبوعيًا أو شهريًا</p>
                </div>
              </label>
            </div>

            {/* Recurring sub-options */}
            {isRecurring && (
              <div className="space-y-4 animate-fade-in">
                {/* Warning banner */}
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-700 font-medium">
                    سيتم إرسال طلب حجز متكرر، وسيحتاج إلى موافقة المسؤول
                  </p>
                </div>

                {/* Repeat interval */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">نوع التكرار</label>
                  <div className="flex gap-3">
                    <label className={`flex items-center gap-2 flex-1 p-3 rounded-lg border cursor-pointer transition-colors ${repeatInterval === 'weekly' ? 'border-[#8B0000] bg-red-50' : 'border-gray-200'}`}>
                      <input
                        type="radio" name="repeatInterval" value="weekly"
                        checked={repeatInterval === 'weekly'}
                        onChange={() => setRepeatInterval('weekly')}
                        className="w-4 h-4 text-[#8B0000] focus:ring-[#8B0000]"
                      />
                      <span className="text-sm font-semibold text-gray-800">أسبوعيًا</span>
                    </label>
                    <label className={`flex items-center gap-2 flex-1 p-3 rounded-lg border cursor-pointer transition-colors ${repeatInterval === 'monthly' ? 'border-[#8B0000] bg-red-50' : 'border-gray-200'}`}>
                      <input
                        type="radio" name="repeatInterval" value="monthly"
                        checked={repeatInterval === 'monthly'}
                        onChange={() => setRepeatInterval('monthly')}
                        className="w-4 h-4 text-[#8B0000] focus:ring-[#8B0000]"
                      />
                      <span className="text-sm font-semibold text-gray-800">شهريًا</span>
                    </label>
                  </div>
                </div>

                {/* End type */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">نهاية التكرار</label>
                  <div className="space-y-2">
                    {/* By count */}
                    <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${repeatEndType === 'count' ? 'border-[#8B0000] bg-red-50' : 'border-gray-200'}`}>
                      <input
                        type="radio" name="repeatEndType" value="count"
                        checked={repeatEndType === 'count'}
                        onChange={() => setRepeatEndType('count')}
                        className="w-4 h-4 text-[#8B0000] focus:ring-[#8B0000] flex-shrink-0"
                      />
                      <span className="text-sm font-semibold text-gray-800 flex-shrink-0">عدد المرات:</span>
                      <input
                        type="number"
                        min="2" max="52"
                        value={repeatCount}
                        onChange={(e) => setRepeatCount(Math.max(2, Math.min(52, parseInt(e.target.value) || 2)))}
                        disabled={repeatEndType !== 'count'}
                        onClick={(e) => { e.preventDefault(); setRepeatEndType('count'); }}
                        className="w-20 px-3 py-1.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#8B0000] outline-none text-sm font-bold text-center disabled:opacity-40"
                        dir="ltr"
                      />
                      <span className="text-sm text-gray-500">مرة</span>
                    </label>
                    {/* By date */}
                    <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${repeatEndType === 'date' ? 'border-[#8B0000] bg-red-50' : 'border-gray-200'}`}>
                      <input
                        type="radio" name="repeatEndType" value="date"
                        checked={repeatEndType === 'date'}
                        onChange={() => setRepeatEndType('date')}
                        className="w-4 h-4 text-[#8B0000] focus:ring-[#8B0000] flex-shrink-0"
                      />
                      <span className="text-sm font-semibold text-gray-800 flex-shrink-0">حتى تاريخ:</span>
                      <input
                        type="date"
                        value={repeatUntil}
                        min={formData.booking_date || undefined}
                        onChange={(e) => setRepeatUntil(e.target.value)}
                        disabled={repeatEndType !== 'date'}
                        onClick={(e) => { e.preventDefault(); setRepeatEndType('date'); }}
                        className="flex-1 px-3 py-1.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#8B0000] outline-none text-sm disabled:opacity-40"
                      />
                    </label>
                  </div>
                </div>

                {/* Preview of generated dates */}
                {formData.booking_date && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 space-y-1.5">
                    <div className="flex items-center gap-2 text-blue-700 font-bold text-sm">
                      <Calendar className="w-4 h-4" />
                      مواعيد الحجز المتكرر
                    </div>
                    {(() => {
                      const dates = generateOccurrenceDates(
                        formData.booking_date,
                        repeatInterval,
                        repeatEndType,
                        repeatEndType === 'count' ? repeatCount : 999,
                        repeatUntil,
                      ).slice(0, 12); // show first 12
                      const total = repeatEndType === 'count' ? repeatCount :
                        generateOccurrenceDates(formData.booking_date, repeatInterval, 'date', 999, repeatUntil).length;
                      return (
                        <>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {dates.map((d, i) => (
                              <span key={i} className="bg-white border border-blue-200 text-blue-800 text-xs font-semibold px-2 py-1 rounded-lg">
                                {formatDateAr(d)}
                              </span>
                            ))}
                            {total > 12 && (
                              <span className="bg-blue-100 text-blue-600 text-xs font-semibold px-2 py-1 rounded-lg">
                                +{total - 12} أخرى
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-blue-600 font-medium">
                            إجمالي: {repeatEndType === 'count' ? repeatCount : total} مرة
                          </p>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Place Selection */}
        <div className="space-y-3">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <label className="block text-base sm:text-lg font-bold text-[#8B0000]">الأماكن المطلوبة</label>
            <span className="bg-red-50 text-[#8B0000] px-3 py-1 rounded-full text-sm font-bold border border-red-100 flex-shrink-0">
              عدد الأماكن: {formData.place_ids.length}
            </span>
          </div>
          <div className="bg-gray-50 p-3 sm:p-4 rounded-xl border border-gray-200 max-h-[380px] overflow-y-auto space-y-5">
            {placesLoading ? (
              <div className="flex items-center justify-center py-8 gap-3 text-gray-500">
                <Loader2 className="w-6 h-6 animate-spin text-[#8B0000]" />
                <span className="font-semibold">جارٍ تحميل الأماكن...</span>
              </div>
            ) : (
              buildings.map((building) => (
                <div key={building} className="space-y-2">
                  <h3 className="font-bold text-gray-900 border-b-2 border-gray-200 pb-2 text-sm sm:text-base">
                    {building}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                    {places.filter((p) => p.building === building).map((place) => {
                      const selected = formData.place_ids.includes(place.id);
                      return (
                        <label
                          key={place.id}
                          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors min-h-[56px] ${
                            selected
                              ? 'bg-red-50 border-[#8B0000]'
                              : 'bg-white border-gray-200 hover:border-[#8B0000]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="mt-1 w-5 h-5 flex-shrink-0 text-[#8B0000] rounded focus:ring-[#8B0000]"
                            checked={selected}
                            onChange={() => handlePlaceToggle(place.id)}
                          />
                          <div className="min-w-0">
                            <p className={`font-bold text-sm leading-tight ${selected ? 'text-[#8B0000]' : 'text-gray-900'}`}>
                              {place.floor}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5 break-words">{place.name}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">ملاحظات (اختياري)</label>
          <textarea
            name="notes" value={formData.notes} onChange={handleChange} rows={3}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#8B0000] outline-none resize-none"
            placeholder="أي ملاحظات إضافية..."
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting || placesLoading}
          className="w-full flex items-center justify-center gap-2 bg-[#8B0000] text-white py-4 rounded-xl text-base sm:text-lg font-bold hover:bg-red-900 transition-colors disabled:opacity-70"
        >
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
