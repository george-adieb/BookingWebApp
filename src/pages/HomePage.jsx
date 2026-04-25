import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, CheckCircle } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-[75vh] flex flex-col items-center justify-center text-center px-4 py-8 space-y-8">
      <div className="space-y-4 w-full max-w-2xl">
        <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold text-[#8B0000] leading-tight">
          مرحبًا بك في نظام حجز الأماكن
          <span className="text-xl sm:text-2xl md:text-4xl text-gray-800 mt-2 block">
            في كنيسة مارجرجس سيدي بشر
          </span>
        </h1>

        <div className="bg-red-50 py-4 px-5 rounded-2xl border-r-4 border-[#8B0000] mx-auto">
          <p className="text-lg sm:text-xl md:text-2xl font-serif text-[#8B0000] font-bold leading-relaxed">
            "لِيَكُنْ كُلُّ شَيْءٍ بِلِيَاقَةٍ وَبِحَسَبِ تَرْتِيبٍ"
          </p>
          <p className="text-sm sm:text-md text-[#8B0000] mt-2 font-semibold">
            ١ كورنثوس ١٤:٤٠
          </p>
        </div>

        <p className="text-base sm:text-lg text-gray-600 mx-auto mt-2 leading-relaxed">
          هذا النظام يتيح لك حجز القاعات والفصول في مباني الكنيسة المختلفة لخدماتك واجتماعاتك بكل سهولة ويسر.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-xl">
        <Link
          to="/book"
          className="flex-1 flex items-center justify-center gap-3 bg-[#8B0000] text-white px-6 py-4 rounded-xl text-lg font-bold hover:bg-red-900 transition-all shadow-lg hover:shadow-xl"
        >
          <Calendar className="w-6 h-6 flex-shrink-0" />
          احجز مكان الآن
        </Link>

        <Link
          to="/availability"
          className="flex-1 flex items-center justify-center gap-3 bg-white text-[#8B0000] border-2 border-[#8B0000] px-6 py-4 rounded-xl text-lg font-bold hover:bg-red-50 transition-all shadow-md hover:shadow-lg"
        >
          <CheckCircle className="w-6 h-6 flex-shrink-0" />
          عرض الأماكن المتاحة
        </Link>
      </div>
    </div>
  );
}
