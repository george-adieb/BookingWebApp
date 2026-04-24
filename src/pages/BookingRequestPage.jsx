import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Send, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import TimePickerInput from '../components/TimePickerInput';
import { useSearchParams } from 'react-router-dom';

export default function BookingRequestPage() {
  const [searchParams] = useSearchParams();
  const preSelectedPlaceId = searchParams.get('placeId') || '';
  const preSelectedDate    = searchParams.get('date')    || '';

  const [places, setPlaces]     = useState([]);
  const [placesLoading, setPlacesLoading] = useState(true);

  const [formData, setFormData] = useState({
    requester_name: '',
    service_name:   '',
    phone:          '',
    place_ids:      preSelectedPlaceId ? [preSelectedPlaceId] : [],
    booking_date:   preSelectedDate,
    start_time:     '',
    end_time:       '',
    notes:          '',
  });

  const [error, setError]                     = useState('');
  const [unavailablePlaces, setUnavailablePlaces] = useState([]);
  const [success, setSuccess]                 = useState(false);
  const [isSubmitting, setIsSubmitting]       = useState(false);

  // ── Fetch places from Supabase ────────────────────────
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
    setError(''); setUnavailablePlaces([]);
  };

  const handlePlaceToggle = (placeId) => {
    setFormData((prev) => ({
      ...prev,
      place_ids: prev.place_ids.includes(placeId)
        ? prev.place_ids.filter((id) => id !== placeId)
        : [...prev.place_ids, placeId],
    }));
    setError(''); setUnavailablePlaces([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setUnavailablePlaces([]);

    // Validate
    if (formData.place_ids.length === 0) { setError('يجب اختيار مكان واحد على الأقل'); return; }
    if (formData.start_time >= formData.end_time) { setError('وقت الانتهاء يجب أن يكون بعد وقت البدء'); return; }

    setIsSubmitting(true);

    // Check availability for every selected place
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

      if (rpcError) {
        rpcFailed = true;
        break;
      }

      // true  → available (do nothing)
      // false → NOT available, add to conflict list
      if (isAvailable === false) {
        const place = places.find((p) => p.id === placeId);
        if (place) conflicts.push(`${place.building} - ${place.floor} - ${place.name}`);
      }
    }

    if (rpcFailed) {
      setError('حدث خطأ أثناء التحقق من توفر الأماكن، يرجى المحاولة مرة أخرى');
      setIsSubmitting(false);
      return;
    }

    if (conflicts.length > 0) {
      setError('بعض الأماكن المختارة غير متاحة في هذا الوقت');
      setUnavailablePlaces(conflicts);
      setIsSubmitting(false);
      return;
    }

    // Insert booking request
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
      })
      .select('id')
      .single();

    if (insertError || !newRequest) {
      setError('حدث خطأ أثناء إرسال الطلب، يرجى المحاولة مرة أخرى');
      setIsSubmitting(false);
      return;
    }

    // Insert booking_request_places (one row per place)
    const placeRows = formData.place_ids.map((pid) => ({
      booking_request_id: newRequest.id,
      place_id:           pid,
    }));
    const { error: placesInsertError } = await supabase.from('booking_request_places').insert(placeRows);

    if (placesInsertError) {
      setError('تم إنشاء الطلب ولكن حدث خطأ في ربط الأماكن، يرجى التواصل مع المسؤول');
      setIsSubmitting(false);
      return;
    }

    setSuccess(true);
    setIsSubmitting(false);
    setFormData({
      requester_name: '', service_name: '', phone: '', place_ids: [],
      booking_date: '', start_time: '', end_time: '', notes: '',
    });
  };

  // ── Success screen ────────────────────────────────────
  if (success) {
    return (
      <div className="max-w-2xl mx-auto mt-10 p-8 bg-white rounded-2xl shadow-sm border border-green-100 text-center space-y-6">
        <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto" />
        <h2 className="text-3xl font-bold text-gray-900">تم الإرسال بنجاح</h2>
        <p className="text-xl text-gray-600">تم إرسال طلب الحجز بنجاح، في انتظار موافقة المسؤول</p>
        <button onClick={() => setSuccess(false)}
          className="mt-4 px-6 py-3 bg-[#8B0000] text-white rounded-lg font-semibold hover:bg-red-900">
          إرسال طلب آخر
        </button>
      </div>
    );
  }

  // ── Form ──────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="bg-[#8B0000] p-6 text-white text-center">
        <h2 className="text-2xl font-bold">نموذج طلب حجز الأماكن</h2>
      </div>

      <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
            <div className="flex items-center gap-3 text-red-700">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="font-semibold text-lg">{error}</span>
            </div>
            {unavailablePlaces.length > 0 && (
              <ul className="mt-3 list-disc list-inside text-red-600 space-y-1">
                {unavailablePlaces.map((place, i) => <li key={i} className="mr-6">{place}</li>)}
              </ul>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">الاسم</label>
            <input type="text" name="requester_name" required value={formData.requester_name} onChange={handleChange}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#8B0000] outline-none"
              placeholder="اسم مقدم الطلب" />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">رقم الهاتف</label>
            <input type="tel" name="phone" required value={formData.phone} onChange={handleChange}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#8B0000] outline-none"
              placeholder="01xxxxxxxxx" dir="ltr" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="block text-sm font-semibold text-gray-700">الخدمة / الاجتماع</label>
            <input type="text" name="service_name" required value={formData.service_name} onChange={handleChange}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#8B0000] outline-none"
              placeholder="اسم الخدمة أو الاجتماع" />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">التاريخ</label>
            <input type="date" name="booking_date" required value={formData.booking_date} onChange={handleChange}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#8B0000] outline-none" />
          </div>
          <div className="space-y-2 md:col-span-2 grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="start_time" className="block text-sm font-semibold text-gray-700">من الساعة</label>
              <TimePickerInput
                id="start_time"
                value={formData.start_time}
                onChange={(v) => { setFormData((p) => ({ ...p, start_time: v })); setError(''); }}
                placeholder="00:00"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="end_time" className="block text-sm font-semibold text-gray-700">إلى الساعة</label>
              <TimePickerInput
                id="end_time"
                value={formData.end_time}
                onChange={(v) => { setFormData((p) => ({ ...p, end_time: v })); setError(''); }}
                placeholder="00:00"
              />
            </div>
          </div>

          {/* Place Selection */}
          <div className="space-y-3 md:col-span-2">
            <div className="flex justify-between items-end">
              <label className="block text-lg font-bold text-[#8B0000]">الأماكن المطلوبة</label>
              <span className="bg-red-50 text-[#8B0000] px-3 py-1 rounded-full text-sm font-bold border border-red-100">
                عدد الأماكن المختارة: {formData.place_ids.length}
              </span>
            </div>
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 max-h-[400px] overflow-y-auto space-y-6">
              {placesLoading ? (
                <div className="flex items-center justify-center py-8 gap-3 text-gray-500">
                  <Loader2 className="w-6 h-6 animate-spin text-[#8B0000]" />
                  <span className="font-semibold">جارٍ تحميل الأماكن...</span>
                </div>
              ) : (
                buildings.map((building) => (
                  <div key={building} className="space-y-3">
                    <h3 className="font-bold text-gray-900 border-b-2 border-gray-200 pb-2">{building}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {places.filter((p) => p.building === building).map((place) => {
                        const selected = formData.place_ids.includes(place.id);
                        return (
                          <label key={place.id}
                            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selected ? 'bg-red-50 border-[#8B0000]' : 'bg-white border-gray-200 hover:border-[#8B0000]'}`}>
                            <input type="checkbox"
                              className="mt-1 w-5 h-5 text-[#8B0000] rounded focus:ring-[#8B0000]"
                              checked={selected} onChange={() => handlePlaceToggle(place.id)} />
                            <div>
                              <p className={`font-bold ${selected ? 'text-[#8B0000]' : 'text-gray-900'}`}>{place.floor}</p>
                              <p className="text-sm text-gray-500">{place.name}</p>
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

          <div className="space-y-2 md:col-span-2">
            <label className="block text-sm font-semibold text-gray-700">ملاحظات (اختياري)</label>
            <textarea name="notes" value={formData.notes} onChange={handleChange} rows={3}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#8B0000] outline-none"
              placeholder="أي ملاحظات إضافية..." />
          </div>
        </div>

        <button type="submit" disabled={isSubmitting || placesLoading}
          className="w-full flex items-center justify-center gap-2 bg-[#8B0000] text-white py-4 rounded-xl text-lg font-bold hover:bg-red-900 transition-colors disabled:opacity-70">
          {isSubmitting ? (
            <><Loader2 className="w-5 h-5 animate-spin" />جارٍ الإرسال...</>
          ) : (
            <><Send className="w-5 h-5 ml-2" />إرسال طلب الحجز</>
          )}
        </button>
      </form>
    </div>
  );
}
