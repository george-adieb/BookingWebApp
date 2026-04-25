import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Calendar, Home, CheckCircle, Menu, X, Lock } from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  const navLinks = [
    { name: 'الرئيسية', path: '/', icon: <Home className="w-5 h-5 flex-shrink-0" /> },
    { name: 'احجز مكان', path: '/book', icon: <Calendar className="w-5 h-5 flex-shrink-0" /> },
    { name: 'الأماكن المتاحة', path: '/availability', icon: <CheckCircle className="w-5 h-5 flex-shrink-0" /> },
    { name: 'تسجيل دخول المسؤول', path: '/admin/login', icon: <Lock className="w-5 h-5 flex-shrink-0" /> },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <header className="bg-white shadow-sm border-b-4 border-[#8B0000] relative z-40">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16 sm:h-20">

          {/* Logo & Brand */}
          <Link
            to="/"
            className="flex items-center gap-2 min-w-0 flex-1"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <img
              src="/church-logo.png"
              alt="شعار الكنيسة"
              className="h-10 sm:h-14 w-auto object-contain flex-shrink-0"
            />
            <div className="flex flex-col min-w-0">
              <span className="text-base sm:text-xl font-bold text-[#8B0000] leading-tight truncate">
                نظام حجز الأماكن
              </span>
              <span className="text-[10px] sm:text-xs font-semibold text-[#8B0000] opacity-70 hidden sm:block leading-tight">
                كنيسة الشهيد العظيم مارجرجس سيدي بشر
              </span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-1 flex-shrink-0">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={clsx(
                  'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-semibold transition-colors whitespace-nowrap',
                  isActive(link.path)
                    ? 'text-[#8B0000] bg-red-50'
                    : 'text-gray-600 hover:text-[#8B0000] hover:bg-red-50'
                )}
              >
                {link.icon}
                {link.name}
              </Link>
            ))}
          </nav>

          {/* Mobile Hamburger Button */}
          <button
            id="mobile-menu-btn"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden flex items-center justify-center p-2 rounded-lg text-gray-600 hover:text-[#8B0000] hover:bg-red-50 transition-colors flex-shrink-0 mr-2"
            aria-label={isMobileMenuOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Nav Dropdown */}
      {isMobileMenuOpen && (
        <div className="lg:hidden bg-white border-t border-gray-100 shadow-lg">
          <nav className="px-4 py-3 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={clsx(
                  'flex items-center gap-3 w-full px-4 py-3 rounded-xl text-base font-semibold transition-colors',
                  isActive(link.path)
                    ? 'text-[#8B0000] bg-red-50'
                    : 'text-gray-700 hover:text-[#8B0000] hover:bg-red-50'
                )}
              >
                {link.icon}
                <span>{link.name}</span>
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
