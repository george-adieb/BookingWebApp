import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Calendar as CalendarIcon, Loader2, ChevronRight, ChevronLeft, CalendarDays, Filter } from 'lucide-react';

function formatDateAr(dateStr) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('ar-EG', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch { return dateStr; }
}

function getLocalISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatArabic12(hhmm) {
  if (!hhmm || typeof hhmm !== 'string') return hhmm || '—';
  const match = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return hhmm;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  let hour12;
  let period;
  if (h === 0) { hour12 = 12; period = 'صباحًا'; }
  else if (h < 12) { hour12 = h; period = 'صباحًا'; }
  else if (h === 12) { hour12 = 12; period = 'مساءً'; }
  else { hour12 = h - 12; period = 'مساءً'; }
  return `${String(hour12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
}

export default function AboTalatCalendarView({ onBookClick, onDateSelect }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState('all'); // all, one_day, retreat
  const [selectedDay, setSelectedDay] = useState(null);

  // Month navigation
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  // Fetch approved bookings for the current month window (plus buffer)
  useEffect(() => {
    async function fetchMonthBookings() {
      setLoading(true);
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      // Fetch window: prev month to next month to catch overlapping retreats
      const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
      const endDate = new Date(year, month + 2, 0).toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('booking_requests')
        .select('id, abo_talat_booking_type, booking_date, start_time, end_time, check_in_date, check_out_date, check_out_period')
        .eq('booking_category', 'abo_talat')
        .eq('status', 'approved')
        .or(`booking_date.gte.${startDate},check_in_date.gte.${startDate}`)
        .or(`booking_date.lte.${endDate},check_in_date.lte.${endDate}`);

      if (!error && data) {
        setBookings(data);
      }
      setLoading(false);
    }
    fetchMonthBookings();
  }, [currentDate]);

  // Compute days in current month
  const daysInMonth = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const days = [];
    const date = new Date(year, month, 1);
    while (date.getMonth() === month) {
      days.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }
    return days;
  }, [currentDate]);

  // Map each day to its availability status
  const dayStatuses = useMemo(() => {
    const statuses = {};
    daysInMonth.forEach(dayObj => {
      const dateStr = getLocalISODate(dayObj);
      const dayBookings = [];
      let isRetreatBlocked = false;
      let retreatDetails = null;

      bookings.forEach(b => {
        // Apply filter if needed, but actually we should calculate true availability first, 
        // then maybe filter what's displayed. The prompt implies filtering what is shown.
        // Actually, if a user filters 'one_day', they still need to know it's blocked by a retreat.
        // So we calculate total availability regardless of filter.
        
        if (b.abo_talat_booking_type === 'retreat') {
          const inDate = b.check_in_date;
          const outDate = b.check_out_date;
          // Calculate effective occupied end date
          let occupiedEnd = outDate;
          if (b.check_out_period === 'morning') {
            const [y, m, d] = outDate.split('-').map(Number);
            const outD = new Date(y, m - 1, d);
            outD.setDate(outD.getDate() - 1);
            occupiedEnd = getLocalISODate(outD);
          }

          if (dateStr >= inDate && dateStr <= occupiedEnd) {
            isRetreatBlocked = true;
            retreatDetails = b;
          }
        } else if (b.abo_talat_booking_type === 'one_day') {
          if (b.booking_date === dateStr) {
            dayBookings.push(b);
          }
        }
      });

      // Filter logic: if user wants to see only retreats, we can hide one_day details, etc.
      // But status color should reflect true availability.
      if (isRetreatBlocked) {
        statuses[dateStr] = {
          status: 'booked',
          label: 'خلوة قائمة',
          color: 'bg-red-50 border-red-200 text-red-800',
          badge: 'bg-red-100 text-red-700',
          details: [`خلوة من ${retreatDetails.check_in_date} إلى ${retreatDetails.check_out_date} - المغادرة ${retreatDetails.check_out_period === 'morning' ? 'صباحًا' : 'مساءً'}`],
          type: 'retreat'
        };
      } else if (dayBookings.length > 0) {
        statuses[dateStr] = {
          status: 'partial',
          label: 'يوجد حجز يوم واحد',
          color: 'bg-amber-50 border-amber-200 text-amber-900',
          badge: 'bg-amber-100 text-amber-700',
          details: dayBookings.map(b => `من ${formatArabic12(b.start_time)} إلى ${formatArabic12(b.end_time)}`),
          type: 'one_day'
        };
      } else {
        statuses[dateStr] = {
          status: 'available',
          label: 'متاح',
          color: 'bg-green-50 border-green-200 text-green-900',
          badge: 'bg-green-100 text-green-700',
          details: [],
          type: 'none'
        };
      }
    });
    return statuses;
  }, [daysInMonth, bookings]);

  const handleDayClick = (dateStr, statusObj) => {
    setSelectedDay(dateStr);
    onDateSelect(dateStr);
  };

  const monthName = currentDate.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-8">
      {/* Header */}
      <div className="bg-[#8B0000] p-4 sm:p-6 text-white text-center">
        <div className="flex items-center justify-center gap-3 mb-1">
          <CalendarDays className="w-6 h-6 sm:w-7 sm:h-7" />
          <h2 className="text-xl sm:text-2xl font-bold">جدول إتاحة بيت أبوتلات</h2>
        </div>
        <p className="text-sm text-red-200">يمكنك مراجعة المواعيد المتاحة قبل إرسال طلب الحجز</p>
      </div>

      <div className="p-4 sm:p-6">
        {/* Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
          <div className="flex items-center gap-4 bg-gray-50 rounded-lg p-1.5 border border-gray-200">
            <button onClick={prevMonth} className="p-2 hover:bg-white rounded-md transition-colors"><ChevronRight className="w-5 h-5" /></button>
            <span className="font-bold text-gray-800 min-w-[120px] text-center">{monthName}</span>
            <button onClick={nextMonth} className="p-2 hover:bg-white rounded-md transition-colors"><ChevronLeft className="w-5 h-5" /></button>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Filter className="w-4 h-4 text-gray-500" />
            <select 
              value={filterType} 
              onChange={(e) => setFilterType(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#8B0000]"
            >
              <option value="all">كل الحجوزات</option>
              <option value="one_day">يوم واحد فقط</option>
              <option value="retreat">خلوات فقط</option>
            </select>
          </div>
        </div>

        {/* Selected Date Warning */}
        {selectedDay && dayStatuses[selectedDay]?.status !== 'available' && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 flex items-start gap-3">
            <CalendarIcon className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600" />
            <div>
              <p className="font-bold text-sm">هذا اليوم يحتوي على حجز، برجاء اختيار موعد آخر إذا أمكن.</p>
              <p className="text-xs mt-1">تاريخ: {formatDateAr(selectedDay)}</p>
            </div>
          </div>
        )}

        {/* Calendar Grid/List */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-gray-400">
            <Loader2 className="w-10 h-10 animate-spin mb-4 text-[#8B0000]" />
            <p>جاري تحميل المواعيد...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {daysInMonth.map(dayObj => {
              const dateStr = getLocalISODate(dayObj);
              const s = dayStatuses[dateStr];
              
              // Apply filter
              if (filterType === 'one_day' && s.type === 'retreat') return null;
              if (filterType === 'retreat' && s.type === 'one_day') return null;

              const isSelected = selectedDay === dateStr;

              return (
                <div 
                  key={dateStr}
                  onClick={() => handleDayClick(dateStr, s)}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${s.color} ${isSelected ? 'ring-2 ring-offset-2 ring-[#8B0000] border-[#8B0000]' : 'hover:shadow-md'}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="text-2xl font-black">{dayObj.getDate()}</div>
                      <div className="text-xs font-semibold opacity-75">{dayObj.toLocaleDateString('ar-EG', { weekday: 'short' })}</div>
                    </div>
                    <span className={`px-2 py-1 rounded-md text-xs font-bold ${s.badge}`}>
                      {s.label}
                    </span>
                  </div>
                  
                  {s.details.length > 0 ? (
                    <ul className="mt-3 space-y-1">
                      {s.details.map((det, idx) => (
                        <li key={idx} className="text-xs font-semibold opacity-90">• {det}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="mt-3 text-xs font-semibold opacity-75">لا توجد حجوزات</div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Actions */}
        <div className="mt-8 pt-6 border-t border-gray-100 flex justify-center">
          <button 
            onClick={onBookClick}
            className="w-full sm:w-auto px-8 py-3.5 bg-[#8B0000] text-white rounded-xl font-bold text-lg hover:bg-red-900 transition-colors shadow-sm"
          >
            احجز بيت أبوتلات
          </button>
        </div>
      </div>
    </div>
  );
}
