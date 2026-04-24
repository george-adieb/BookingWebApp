import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import StatusBadge from '../components/StatusBadge';
import {
  LogOut, Filter, Check, X, Calendar, MapPin, Clock, Phone,
  User, LayoutDashboard, Search, Loader2, AlertCircle,
  FileText, StickyNote, List, Inbox,
} from 'lucide-react';

const formatPlace = (p) => p ? `${p.building} - ${p.floor} - ${p.name}` : '—';

// ── WhatsApp helper ───────────────────────────────────────
function normalizePhone(phone) {
  // Remove spaces, dashes, non-numeric chars except leading +
  let cleaned = phone.replace(/[\s\-]/g, '').replace(/[^\d+]/g, '');
  if (cleaned.startsWith('0')) cleaned = '+20' + cleaned.slice(1);
  return cleaned;
}

function buildWaMessage(booking) {
  if (booking.status === 'approved') {
    return encodeURIComponent(
      `مرحبًا، تم تأكيد حجزك.\nالتاريخ: ${booking.booking_date}\nالوقت: من ${booking.start_time} إلى ${booking.end_time}`
    );
  }
  if (booking.status === 'rejected') {
    return encodeURIComponent('مرحبًا، نعتذر، لم يتم قبول طلب الحجز.');
  }
  return null;
}

function WhatsAppLink({ booking }) {
  if (!booking.phone) return null;
  const phone   = normalizePhone(booking.phone);
  const message = buildWaMessage(booking);
  const url     = message
    ? `https://wa.me/${phone}?text=${message}`
    : `https://wa.me/${phone}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title="تواصل عبر واتساب"
      className="inline-flex items-center justify-center w-5 h-5 text-[#25D366] hover:scale-110 hover:opacity-80 transition-transform flex-shrink-0"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.855L.057 23.526a.75.75 0 0 0 .917.917l5.671-1.475A11.953 11.953 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.713 9.713 0 0 1-4.953-1.354l-.355-.21-3.667.954.975-3.562-.23-.366A9.712 9.712 0 0 1 2.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z"/>
      </svg>
    </a>
  );
}

// ── Stat Card ─────────────────────────────────────────────
function StatCard({ icon, colorKey, label, value }) {
  const cls = {
    yellow: ['border-yellow-100', 'bg-yellow-50 text-yellow-600'],
    green:  ['border-green-100',  'bg-green-50 text-green-600'],
    red:    ['border-red-100',    'bg-red-50 text-red-600'],
  }[colorKey];
  return (
    <div className={`bg-white p-6 rounded-2xl shadow-sm border ${cls[0]} flex items-center gap-4`}>
      <div className={`w-14 h-14 rounded-full flex items-center justify-center ${cls[1]}`}>{icon}</div>
      <div>
        <p className="text-sm font-semibold text-gray-500">{label}</p>
        <p className="text-3xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

// ── Tab Button ────────────────────────────────────────────
function TabBtn({ active, onClick, icon, children }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${active ? 'bg-[#8B0000] text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
      {icon}{children}
    </button>
  );
}

// ── Reject Modal ──────────────────────────────────────────
function RejectModal({ onConfirm, onCancel, loading }) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 space-y-4" dir="rtl">
        <h3 className="text-lg font-bold text-gray-900">سبب الرفض</h3>
        <p className="text-sm text-gray-500">يمكنك كتابة سبب الرفض أو ترك الحقل فارغاً</p>
        <textarea
          rows={3} value={reason} onChange={(e) => setReason(e.target.value)} disabled={loading}
          placeholder="سبب الرفض (اختياري)..."
          className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#8B0000] outline-none resize-none"
        />
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} disabled={loading}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold">إلغاء</button>
          <button onClick={() => onConfirm(reason)} disabled={loading}
            className="px-5 py-2 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 flex items-center gap-2 disabled:opacity-70">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}تأكيد الرفض
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Booking Card (shared for both tabs) ───────────────────
function BookingCard({ booking, actionLoading, actionError, onApprove, onReject, showActions }) {
  return (
    <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col xl:flex-row gap-6 hover:shadow-md transition-shadow">
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-gray-500 text-sm font-semibold"><User className="w-4 h-4" />مقدم الطلب</div>
          <p className="font-bold text-gray-900">{booking.requester_name}</p>
          <p className="text-sm text-gray-600">{booking.service_name}</p>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-gray-500 text-sm font-semibold"><Phone className="w-4 h-4" />رقم الهاتف</div>
          <p className="font-bold text-gray-900" dir="ltr">{booking.phone}</p>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-gray-500 text-sm font-semibold"><Calendar className="w-4 h-4" />الزمان</div>
          <p className="font-bold text-gray-900">{booking.booking_date}</p>
          <p className="text-sm text-gray-600">{booking.start_time} — {booking.end_time}</p>
        </div>
        <div className="space-y-1 md:col-span-2 lg:col-span-2">
          <div className="flex items-center gap-2 text-gray-500 text-sm font-semibold"><MapPin className="w-4 h-4" />الأماكن المطلوبة</div>
          <div className="flex flex-wrap gap-2 mt-1">
            {booking.places?.length
              ? booking.places.map((p) => (
                  <span key={p.id} className="bg-red-50 text-[#8B0000] border border-red-100 rounded-lg px-3 py-1 text-sm font-semibold">{formatPlace(p)}</span>
                ))
              : <span className="text-sm text-gray-400">لم يتم تحديد أماكن</span>}
          </div>
        </div>
        {booking.notes && (
          <div className="space-y-1 lg:col-span-3">
            <div className="flex items-center gap-2 text-gray-500 text-sm font-semibold"><StickyNote className="w-4 h-4" />ملاحظات</div>
            <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">{booking.notes}</p>
          </div>
        )}
      </div>

      <div className="flex flex-row xl:flex-col justify-between items-center xl:items-end gap-4 border-t xl:border-t-0 xl:border-r border-gray-100 pt-4 xl:pt-0 xl:pr-6 min-w-[140px]">
        <StatusBadge status={booking.status} />
        {actionError?.id === booking.id && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-xs font-semibold max-w-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{actionError.message}
          </div>
        )}
        {showActions && booking.status === 'pending' && (
          <div className="flex gap-2">
            <button onClick={() => onApprove(booking)} disabled={actionLoading === booking.id}
              title="موافقة"
              className="p-2 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50">
              {actionLoading === booking.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
            </button>
            <button onClick={() => onReject(booking.id)} disabled={actionLoading === booking.id}
              title="رفض"
              className="p-2 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        {booking.admin_note && (
          <div className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded max-w-xs text-right">سبب الرفض: {booking.admin_note}</div>
        )}
        <p className="text-xs text-gray-400" dir="ltr">
          {new Date(booking.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
        </p>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────
export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab]       = useState('pending');
  const [bookings, setBookings]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [actionError, setActionError]   = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);

  const [pf, setPf] = useState({ search: '', date: '' });
  const [af, setAf] = useState({ search: '', date: '', status: '', building: '', service: '' });

  // Auth guard
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate('/admin/login');
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) navigate('/admin/login');
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  // Fetch all bookings with nested places via FK relationship
  const fetchBookings = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('booking_requests')
      .select(`
        *,
        booking_request_places (
          place_id,
          places (
            id,
            building,
            floor,
            name
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (error) { console.error(error); setBookings([]); setLoading(false); return; }

    // Normalize: attach a flat `places` array to each booking
    const enriched = (data || []).map((r) => ({
      ...r,
      places: r.booking_request_places
        ?.map((item) => item.places)
        .filter(Boolean) || [],
    }));

    setBookings(enriched);
    setLoading(false);
  }, []);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const handleLogout = async () => { await supabase.auth.signOut(); navigate('/admin/login'); };

  const handleApprove = async (booking) => {
    setActionLoading(booking.id); setActionError(null);

    // Use place IDs directly from the junction table rows — never from booking_requests.place_id
    const placeItems = booking.booking_request_places || [];

    for (const item of placeItems) {
      const placeId = item.place_id;

      const { data, error } = await supabase.rpc('check_place_availability', {
        p_place_id:   placeId,
        p_date:       booking.booking_date,
        p_start_time: booking.start_time,
        p_end_time:   booking.end_time,
        p_exclude_id: booking.id,
      });

      if (error) {
        setActionError({ id: booking.id, message: 'حدث خطأ أثناء التحقق من توفر الأماكن، يرجى المحاولة مرة أخرى' });
        setActionLoading(null); return;
      }

      // true  → available, continue to next place
      // false → NOT available, block approval
      if (data === false) {
        setActionError({ id: booking.id, message: 'لا يمكن الموافقة لأن بعض الأماكن أصبحت محجوزة' });
        setActionLoading(null); return;
      }
    }

    const { error } = await supabase.from('booking_requests').update({ status: 'approved' }).eq('id', booking.id);
    if (error) setActionError({ id: booking.id, message: 'حدث خطأ أثناء الموافقة، يرجى المحاولة مرة أخرى' });
    setActionLoading(null); fetchBookings();
  };

  const handleRejectConfirm = async (reason) => {
    setActionLoading(rejectTarget);
    const { error } = await supabase.from('booking_requests')
      .update({ status: 'rejected', admin_note: reason || null }).eq('id', rejectTarget);
    if (error) setActionError({ id: rejectTarget, message: 'حدث خطأ أثناء الرفض' });
    setActionLoading(null); setRejectTarget(null); fetchBookings();
  };

  // Stats
  const pendingCount  = bookings.filter((b) => b.status === 'pending').length;
  const approvedCount = bookings.filter((b) => b.status === 'approved').length;
  const rejectedCount = bookings.filter((b) => b.status === 'rejected').length;

  // Pending tab filter
  const pendingBookings = bookings.filter((b) => {
    if (b.status !== 'pending') return false;
    if (pf.date && b.booking_date !== pf.date) return false;
    const t = pf.search.toLowerCase();
    return !t || b.requester_name?.toLowerCase().includes(t) || b.service_name?.toLowerCase().includes(t)
      || b.places?.some((p) => formatPlace(p).toLowerCase().includes(t));
  });

  // All bookings tab filter
  const allBuildings = [...new Set(bookings.flatMap((b) => b.places?.map((p) => p?.building)).filter(Boolean))];
  const allBookings = bookings.filter((b) => {
    if (af.status  && b.status !== af.status) return false;
    if (af.date    && b.booking_date !== af.date) return false;
    if (af.building && !b.places?.some((p) => p?.building === af.building)) return false;
    if (af.service  && !b.service_name?.toLowerCase().includes(af.service.toLowerCase())) return false;
    if (af.search) {
      const t = af.search.toLowerCase();
      if (!b.requester_name?.toLowerCase().includes(t) && !b.phone?.includes(af.search)) return false;
    }
    return true;
  });

  const statusLabel = { pending: 'في انتظار الموافقة', approved: 'تمت الموافقة', rejected: 'مرفوض' };

  return (
    <div className="space-y-6 pb-12">
      {rejectTarget && (
        <RejectModal loading={actionLoading === rejectTarget} onConfirm={handleRejectConfirm} onCancel={() => setRejectTarget(null)} />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-red-50 text-[#8B0000] rounded-xl"><LayoutDashboard className="w-6 h-6" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">لوحة تحكم المسؤول</h1>
            <p className="text-sm text-gray-500">إدارة ومتابعة طلبات الحجز</p>
          </div>
        </div>
        <button onClick={handleLogout}
          className="flex items-center gap-2 text-gray-600 hover:text-red-600 font-semibold bg-gray-50 hover:bg-red-50 px-4 py-2 rounded-lg transition-colors">
          <LogOut className="w-5 h-5" />تسجيل الخروج
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={<Clock className="w-7 h-7" />}  colorKey="yellow" label="طلبات في الانتظار" value={pendingCount} />
        <StatCard icon={<Check className="w-7 h-7" />}  colorKey="green"  label="تمت الموافقة"      value={approvedCount} />
        <StatCard icon={<X className="w-7 h-7" />}      colorKey="red"    label="طلبات مرفوضة"     value={rejectedCount} />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-white p-1.5 rounded-xl border border-gray-100 shadow-sm w-fit">
        <TabBtn active={activeTab === 'pending'} onClick={() => setActiveTab('pending')} icon={<Inbox className="w-4 h-4" />}>
          طلبات الانتظار <span className="bg-yellow-100 text-yellow-700 rounded-full px-2 py-0.5 text-xs mr-1">{pendingCount}</span>
        </TabBtn>
        <TabBtn active={activeTab === 'all'} onClick={() => setActiveTab('all')} icon={<List className="w-4 h-4" />}>
          جميع الطلبات
        </TabBtn>
      </div>

      {/* ── Tab 1: Pending ──────────────────────────────── */}
      {activeTab === 'pending' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-3 text-[#8B0000] font-bold"><Filter className="w-4 h-4" />تصفية</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="relative">
                <Search className="w-5 h-5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input type="text" placeholder="بحث بالاسم، الخدمة، أو المكان..." value={pf.search}
                  onChange={(e) => setPf({ ...pf, search: e.target.value })}
                  className="w-full pr-10 pl-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#8B0000] outline-none" />
              </div>
              <input type="date" value={pf.date} onChange={(e) => setPf({ ...pf, date: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#8B0000] outline-none" />
            </div>
          </div>

          {loading && <LoadingState />}
          {!loading && pendingBookings.length === 0 && <EmptyState text="لا توجد طلبات حجز في الانتظار" />}
          {!loading && pendingBookings.map((b) => (
            <BookingCard key={b.id} booking={b} actionLoading={actionLoading} actionError={actionError}
              onApprove={handleApprove} onReject={setRejectTarget} showActions />
          ))}
        </div>
      )}

      {/* ── Tab 2: All Bookings ─────────────────────────── */}
      {activeTab === 'all' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-3 text-[#8B0000] font-bold"><Filter className="w-4 h-4" />تصفية</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="w-5 h-5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input type="text" placeholder="بحث بالاسم أو رقم الهاتف..." value={af.search}
                  onChange={(e) => setAf({ ...af, search: e.target.value })}
                  className="w-full pr-10 pl-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#8B0000] outline-none" />
              </div>
              <input type="text" placeholder="الخدمة أو الاجتماع..." value={af.service}
                onChange={(e) => setAf({ ...af, service: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#8B0000] outline-none" />
              <input type="date" value={af.date} onChange={(e) => setAf({ ...af, date: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#8B0000] outline-none" />
              <select value={af.status} onChange={(e) => setAf({ ...af, status: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#8B0000] outline-none">
                <option value="">جميع الحالات</option>
                <option value="pending">في انتظار الموافقة</option>
                <option value="approved">تمت الموافقة</option>
                <option value="rejected">مرفوض</option>
              </select>
              <select value={af.building} onChange={(e) => setAf({ ...af, building: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#8B0000] outline-none">
                <option value="">جميع المباني</option>
                {allBuildings.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          </div>

          {loading && <LoadingState />}
          {!loading && allBookings.length === 0 && <EmptyState text="لا توجد طلبات مطابقة للبحث" />}

          {/* Desktop Table */}
          {!loading && allBookings.length > 0 && (
            <>
              <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
                <table className="w-full text-sm text-right">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {['الاسم','الخدمة','رقم الهاتف','التاريخ','من الساعة','إلى الساعة','الأماكن','الحالة','ملاحظات المسؤول','تاريخ الطلب'].map((h) => (
                        <th key={h} className="px-4 py-3 font-bold text-gray-600 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {allBookings.map((b) => (
                      <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">{b.requester_name}</td>
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{b.service_name}</td>
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap" dir="ltr">
                          <div className="flex items-center gap-1.5">
                            <span>{b.phone}</span>
                            <WhatsAppLink booking={b} />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{b.booking_date}</td>
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap" dir="ltr">{b.start_time}</td>
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap" dir="ltr">{b.end_time}</td>
                        <td className="px-4 py-3 max-w-[220px]">
                          <div className="flex flex-col gap-1">
                            {b.places?.length
                              ? b.places.map((p) => (
                                  <span key={p.id} className="bg-red-50 text-[#8B0000] border border-red-100 rounded px-2 py-0.5 text-xs font-semibold whitespace-nowrap">{formatPlace(p)}</span>
                                ))
                              : <span className="text-gray-400 text-xs">لم يتم تحديد أماكن</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={b.status} /></td>
                        <td className="px-4 py-3 text-gray-600 max-w-[180px]">
                          {b.admin_note ? <span className="text-red-600 text-xs">{b.admin_note}</span> : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs" dir="ltr">
                          {new Date(b.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-4">
                {allBookings.map((b) => (
                  <BookingCard key={b.id} booking={b} actionLoading={null} actionError={null} showActions={false} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Shared UI ─────────────────────────────────────────────
function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 bg-white rounded-2xl border border-dashed border-gray-200">
      <Loader2 className="w-10 h-10 text-[#8B0000] animate-spin" />
      <p className="text-gray-500 font-semibold text-lg">جارٍ تحميل الطلبات...</p>
    </div>
  );
}
function EmptyState({ text }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 bg-white rounded-2xl border border-dashed border-gray-300">
      <FileText className="w-14 h-14 text-gray-300" />
      <p className="text-gray-500 font-semibold text-lg">{text}</p>
    </div>
  );
}
