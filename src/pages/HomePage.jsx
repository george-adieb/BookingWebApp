import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, CheckCircle } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center text-center px-4 space-y-12">
      <div className="space-y-6">
        <h1 className="text-3xl md:text-5xl font-bold text-[#8B0000] leading-tight">
          مرحبًا بك في نظام حجز الأماكن
          <br/>
          <span className="text-2xl md:text-4xl text-gray-800 mt-2 block">في كنيسة مارجرجس سيدي بشر</span>
        </h1>
        
        <div className="bg-red-50 py-4 px-6 rounded-2xl border-r-4 border-[#8B0000] max-w-lg mx-auto my-6 inline-block">
          <p className="text-xl md:text-2xl font-serif text-[#8B0000] font-bold">
            "لِيَكُنْ كُلُّ شَيْءٍ بِلِيَاقَةٍ وَبِحَسَبِ تَرْتِيبٍ"
          </p>
          <p className="text-md text-[#8B0000] mt-2 font-semibold">
            ١ كورنثوس ١٤:٤٠
          </p>
        </div>

        <p className="text-lg text-gray-600 max-w-2xl mx-auto mt-4 leading-relaxed">
          هذا النظام يتيح لك حجز القاعات والفصول في مباني الكنيسة المختلفة لخدماتك واجتماعاتك بكل سهولة ويسر.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-6 w-full max-w-xl justify-center">
        <Link 
          to="/book" 
          className="flex-1 flex items-center justify-center gap-3 bg-[#8B0000] text-white px-8 py-5 rounded-xl text-xl font-bold hover:bg-red-900 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1"
        >
          <Calendar className="w-6 h-6" />
          احجز مكان الآن
        </Link>
        
        <Link 
          to="/availability" 
          className="flex-1 flex items-center justify-center gap-3 bg-white text-[#8B0000] border-2 border-[#8B0000] px-8 py-5 rounded-xl text-xl font-bold hover:bg-red-50 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-1"
        >
          <CheckCircle className="w-6 h-6" />
          عرض الحجوزات المتاحة
        </Link>
      </div>
    </div>
  );
}
