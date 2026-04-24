import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Calendar, Home, CheckCircle, Menu, X } from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  const navLinks = [
    { name: 'الرئيسية', path: '/', icon: <Home className="w-5 h-5 ml-2" /> },
    { name: 'احجز مكان', path: '/book', icon: <Calendar className="w-5 h-5 ml-2" /> },
    { name: 'الأماكن المتاحة', path: '/availability', icon: <CheckCircle className="w-5 h-5 ml-2" /> },
    { name: 'تسجيل دخول المسؤول', path: '/admin/login', icon: <Menu className="w-5 h-5 ml-2 opacity-50" /> },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <header className="bg-white shadow-sm border-b-4 border-[#8B0000]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-24">
          
          {/* Logo & Brand */}
          <Link to="/" className="flex items-center gap-3">
            <img src="/church-logo.png" alt="شعار الكنيسة" className="h-16 w-auto object-contain" />
            <div className="flex flex-col">
              <span className="text-xl font-bold text-[#8B0000]">نظام حجز الأماكن</span>
              <span className="text-xs font-semibold text-[#FFD700] hidden sm:block">كنيسة الشهيد العظيم مارجرجس سيدي بشر</span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex space-x-reverse space-x-6">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={clsx(
                  'flex items-center px-3 py-2 rounded-md text-sm font-semibold transition-colors',
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

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-gray-600 hover:text-[#8B0000] focus:outline-none p-2"
            >
              {isMobileMenuOpen ? <X className="h-7 w-7" /> : <Menu className="h-7 w-7" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 shadow-inner">
          <div className="px-4 pt-2 pb-4 space-y-2">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={clsx(
                  'flex items-center w-full px-4 py-3 rounded-md text-base font-medium',
                  isActive(link.path)
                    ? 'text-[#8B0000] bg-red-50'
                    : 'text-gray-700 hover:text-[#8B0000] hover:bg-gray-50'
                )}
              >
                {link.icon}
                {link.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
