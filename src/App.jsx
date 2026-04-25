import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Header from './components/Header';
import HomePage from './pages/HomePage';
import BookingRequestPage from './pages/BookingRequestPage';
import AvailabilityPage from './pages/AvailabilityPage';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminDashboard from './pages/AdminDashboard';

const WHATSAPP_NUMBER = '201223932191';
const WHATSAPP_URL    = `https://wa.me/${WHATSAPP_NUMBER}`;

function WhatsAppButton() {
  const { pathname } = useLocation();
  if (pathname.startsWith('/admin')) return null;

  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      title="تواصل مع المسئول عبر واتساب"
      className="fixed bottom-5 left-4 z-50 flex items-center gap-2 bg-[#25D366] hover:bg-[#1ebe5d] text-white font-bold px-3 py-3 sm:px-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
      style={{ direction: 'rtl' }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 flex-shrink-0">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.855L.057 23.526a.75.75 0 0 0 .917.917l5.671-1.475A11.953 11.953 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.713 9.713 0 0 1-4.953-1.354l-.355-.21-3.667.954.975-3.562-.23-.366A9.712 9.712 0 0 1 2.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z"/>
      </svg>
      <span className="text-sm whitespace-nowrap hidden sm:inline">تواصل مع المسئول</span>
    </a>
  );
}

function App() {
  return (
    <Router>
      <div
        className="min-h-screen flex flex-col font-sans bg-[#F8F9FA] text-gray-900"
        dir="rtl"
        style={{ overflowX: 'hidden', maxWidth: '100vw' }}
      >
        <Header />
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/book" element={<BookingRequestPage />} />
            <Route path="/availability" element={<AvailabilityPage />} />
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
          </Routes>
        </main>
        <WhatsAppButton />
      </div>
    </Router>
  );
}

export default App;
