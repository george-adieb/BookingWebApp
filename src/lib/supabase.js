import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mock-url.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'mock-key';

export const supabase = createClient(supabaseUrl, supabaseKey);

// --- Mock Data Layer ---
// In a real app, this data would come from the database.
// We provide this to make the UI interactive immediately.

export const MOCK_PLACES = [
  // الكنيسة
  { id: '1', building: 'الكنيسة', floor: 'فوق - صحن', name: 'صحن', is_active: true },
  { id: '2', building: 'الكنيسة', floor: 'فوق - مدرج', name: 'مدرج', is_active: true },
  { id: '3', building: 'الكنيسة', floor: 'تحت - صحن', name: 'صحن', is_active: true },
  
  // مبنى الأمير
  { id: '4', building: 'مبنى الأمير', floor: 'الدور الأول', name: 'قاعة', is_active: true },
  { id: '5', building: 'مبنى الأمير', floor: 'الدور الرابع', name: 'فصل 1', is_active: true },
  { id: '6', building: 'مبنى الأمير', floor: 'الدور الرابع', name: 'فصل 2', is_active: true },
  { id: '7', building: 'مبنى الأمير', floor: 'الدور الخامس', name: 'فصل 1', is_active: true },
  { id: '8', building: 'مبنى الأمير', floor: 'الدور الخامس', name: 'فصل 2', is_active: true },
  { id: '9', building: 'مبنى الأمير', floor: 'الدور السادس', name: 'مكتبة', is_active: true },
  { id: '10', building: 'مبنى الأمير', floor: 'الدور السابع', name: 'مكان', is_active: true },
  { id: '11', building: 'مبنى الأمير', floor: 'الدور الثامن', name: 'مكان', is_active: true },
  { id: '12', building: 'مبنى الأمير', floor: 'الدور التاسع', name: 'مكان', is_active: true },

  // مبنى الروماني
  { id: '13', building: 'مبنى الروماني', floor: 'الدور الأول', name: 'قاعة', is_active: true },
  { id: '14', building: 'مبنى الروماني', floor: 'الدور الأول', name: 'فصل', is_active: true },
  { id: '15', building: 'مبنى الروماني', floor: 'الدور الثالث', name: 'مكان', is_active: true },
  { id: '16', building: 'مبنى الروماني', floor: 'الدور الرابع', name: 'فصل 1', is_active: true },
  { id: '17', building: 'مبنى الروماني', floor: 'الدور الرابع', name: 'فصل 2', is_active: true },
  { id: '18', building: 'مبنى الروماني', floor: 'الدور الرابع', name: 'فصل 3', is_active: true },
  { id: '19', building: 'مبنى الروماني', floor: 'الدور الرابع الداخلي', name: 'فصل 1', is_active: true },
  { id: '20', building: 'مبنى الروماني', floor: 'الدور الرابع الداخلي', name: 'فصل 2', is_active: true },
  { id: '21', building: 'مبنى الروماني', floor: 'الدور الرابع الداخلي', name: 'فصل 3', is_active: true },

  // مبنى البطل
  { id: '22', building: 'مبنى البطل', floor: 'الدور الثاني', name: 'قاعة', is_active: true },
  { id: '23', building: 'مبنى البطل', floor: 'الدور الخامس', name: 'فصل 1', is_active: true },
  { id: '24', building: 'مبنى البطل', floor: 'الدور الخامس', name: 'فصل 2', is_active: true },
  { id: '25', building: 'مبنى البطل', floor: 'الدور السادس', name: 'مكان', is_active: true },
  { id: '26', building: 'مبنى البطل', floor: 'الدور الثاني عشر', name: 'مكان', is_active: true },

  // مبنى السطح
  { id: '27', building: 'مبنى السطح', floor: 'السطح', name: 'فصل 1', is_active: true },
  { id: '28', building: 'مبنى السطح', floor: 'السطح', name: 'فصل 2', is_active: true },
  { id: '29', building: 'مبنى السطح', floor: 'السطح', name: 'فصل 3', is_active: true },
  { id: '30', building: 'مبنى السطح', floor: 'السطح', name: 'فصل 4', is_active: true },
];

export let MOCK_BOOKINGS = [
  {
    id: 'b1',
    requester_name: 'مينا عادل',
    service_name: 'اجتماع الشباب',
    phone: '01234567890',
    place_ids: ['4', '5'], // قاعة مبنى الأمير وفصل 1
    booking_date: new Date().toISOString().split('T')[0],
    start_time: '18:00',
    end_time: '20:00',
    notes: 'تجهيز الداتا شو',
    status: 'pending',
    created_at: new Date().toISOString(),
  },
  {
    id: 'b2',
    requester_name: 'جورج سامي',
    service_name: 'مدارس الأحد',
    phone: '01012345678',
    place_ids: ['1'], // صحن الكنيسة
    booking_date: new Date().toISOString().split('T')[0],
    start_time: '08:00',
    end_time: '10:00',
    notes: '',
    status: 'approved',
    created_at: new Date().toISOString(),
  }
];

export const addMockBooking = (booking) => {
  const newBooking = {
    ...booking,
    id: `b${MOCK_BOOKINGS.length + 1}`,
    status: 'pending',
    created_at: new Date().toISOString()
  };
  MOCK_BOOKINGS = [newBooking, ...MOCK_BOOKINGS];
  return newBooking;
};

export const updateMockBookingStatus = (id, status, admin_note = '') => {
  MOCK_BOOKINGS = MOCK_BOOKINGS.map(b => 
    b.id === id ? { ...b, status, admin_note } : b
  );
};
