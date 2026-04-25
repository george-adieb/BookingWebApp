import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Search, CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ArabicTimePicker, { formatArabic12 } from '../components/ArabicTimePicker';

export default function AvailabilityPage() {
  const navigate = useNavigate();

  const [filters, setFilters] = useState({
    date:       new Date().toISOString().split('T')[0],
    start_time: '',
    end_time:   '',
  });

  const [places, setPlaces]             = useState([]);
  const [placesLoading, setPlacesLoading] = useState(true);
  const [searching, setSearching]       = useState(false);
  const [hasSearched, setHasSearched]   = useState(false);
  const [availability, setAvailability] = useState({});
  const [rpcError, setRpcError]         = useState('');

  useEffect(() => {
    supabase
      .from('places')
      .select('id, building, floor, name')
      .eq('is_active', true)
      .order('building')
      .then(({ data, error }) => {
        if (!error && data) setPlaces(data);
        setPlacesLoading(false);
      });
  }, []);

  const groupedPlaces = places.reduce((acc, place) => {
    if (!acc[place.building]) acc[place.building] = [];
    acc[place.building].push(place);
    return acc;
  }, {});

  const handleSearch = async (e) => {
    e.preventDefault();
    setRpcError('');
    setSearching(true);
    setHasSearched(true);

    const results = {};
    let failed = false;

    for (const place of places) {
      const { data, error } = await supabase.rpc('check_place_availability', {
        p_place_id:   place.id,
        p_date:       filters.date,
        p_start_time: filters.start_time,
        p_end_time:   filters.end_time,
        p_exclude_id: null,
      });

      if (error) { failed = true; break; }
      results[place.id] = data === true;
    }

    if (failed) {
      setRpcError('حدث خطأ أثناء التحقق من توفر الأماكن، يرجى المحاولة مرة أخرى');
      setAvailability({});
    } else {
      setAvailability(results);
    }
    setSearching(false);
  };

  const handleBookClick = (placeId) => {
    navigate(`/book?placeId=${placeId}&date=${filters.date}`);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Search Form */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
        <h2 className="text-xl sm:text-2xl font-bold text-[#8B0000] mb-5 flex items-center gap-2">
          <Search className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
          البحث عن أماكن متاحة
        </h2>

        {/* Stack vertically on mobile, 4-col grid on md+ */}
        <form onSubmit={handleSearch} className="flex flex-col sm:grid sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">التاريخ</label>
            <input
              type="date" required value={filters.date}
              onChange={(e) => setFilters({ ...filters, date: e.target.value })}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#8B0000] outline-none"
            />
          </div>
          <ArabicTimePicker
            label="من الساعة"
            value={filters.start_time}
            onChange={(v) => setFilters({ ...filters, start_time: v })}
            required
          />
          <ArabicTimePicker
            label="إلى الساعة"
            value={filters.end_time}
            onChange={(v) => setFilters({ ...filters, end_time: v })}
            required
          />
          <div className="flex flex-col justify-end">
            <button
              type="submit"
              disabled={searching || placesLoading}
              className="w-full bg-[#8B0000] text-white py-2.5 rounded-lg font-bold hover:bg-red-900 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {searching
                ? <><Loader2 className="w-4 h-4 animate-spin" />جارٍ البحث...</>
                : 'بحث'}
            </button>
          </div>
        </form>

        {/* Time preview */}
        {filters.start_time && filters.end_time && (
          <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-800 font-semibold text-center">
            البحث عن أماكن متاحة من{' '}
            <span className="text-[#8B0000] font-bold">{formatArabic12(filters.start_time)}</span>
            {' '}إلى{' '}
            <span className="text-[#8B0000] font-bold">{formatArabic12(filters.end_time)}</span>
          </div>
        )}
      </div>

      {/* RPC Error */}
      {rpcError && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl font-semibold text-sm sm:text-base">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{rpcError}</span>
        </div>
      )}

      {/* Places loading */}
      {placesLoading && (
        <div className="flex items-center justify-center py-16 gap-3 text-gray-500">
          <Loader2 className="w-7 h-7 animate-spin text-[#8B0000]" />
          <span className="font-semibold text-lg">جارٍ تحميل الأماكن...</span>
        </div>
      )}

      {/* Searching spinner */}
      {searching && (
        <div className="flex items-center justify-center py-16 gap-3 text-gray-500">
          <Loader2 className="w-7 h-7 animate-spin text-[#8B0000]" />
          <span className="font-semibold text-lg">جارٍ التحقق من الأماكن...</span>
        </div>
      )}

      {/* Results */}
      {!searching && hasSearched && !rpcError && (
        <div className="space-y-6">
          {Object.entries(groupedPlaces).map(([building, bPlaces]) => (
            <div key={building} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-gray-50 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
                <h3 className="text-lg sm:text-xl font-bold text-gray-900">{building}</h3>
              </div>
              {/* 1 col mobile → 2 cols sm → 3 cols lg */}
              <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {bPlaces.map((place) => {
                  const isAvailable = availability[place.id] === true;
                  const isChecked   = place.id in availability;

                  return (
                    <div
                      key={place.id}
                      className={`flex flex-col justify-between p-4 rounded-xl border-2 transition-all ${
                        !isChecked
                          ? 'border-gray-200 bg-gray-50'
                          : isAvailable
                          ? 'border-green-100 bg-green-50/30 hover:border-green-300'
                          : 'border-red-100 bg-red-50/30 opacity-75'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2 mb-3">
                        <div className="min-w-0">
                          <p className="font-bold text-gray-900 break-words">{place.name}</p>
                          <p className="text-sm text-gray-600">{place.floor}</p>
                        </div>
                        {isChecked && (
                          isAvailable
                            ? <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-green-500 flex-shrink-0" />
                            : <XCircle className="w-5 h-5 sm:w-6 sm:h-6 text-red-500 flex-shrink-0" />
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-gray-200/50 gap-2">
                        {isChecked && (
                          <span className={`text-sm font-bold ${isAvailable ? 'text-green-700' : 'text-red-700'}`}>
                            {isAvailable ? 'متاح' : 'محجوز'}
                          </span>
                        )}
                        {isAvailable && (
                          <button
                            onClick={() => handleBookClick(place.id)}
                            className="text-sm bg-white border border-green-200 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-50 font-semibold transition-colors"
                          >
                            احجز الآن
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
