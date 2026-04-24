import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Search, CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import TimePickerInput from '../components/TimePickerInput';

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
  const [availability, setAvailability] = useState({}); // placeId → true/false
  const [rpcError, setRpcError]         = useState('');

  // Fetch all active places on mount
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

  // Group by building
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

      if (error) {
        failed = true;
        break;
      }

      // true  → available
      // false → NOT available
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
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Search Form */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-2xl font-bold text-[#8B0000] mb-6 flex items-center gap-2">
          <Search className="w-6 h-6" />
          البحث عن أماكن متاحة
        </h2>

        <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">التاريخ</label>
            <input
              type="date" required value={filters.date}
              onChange={(e) => setFilters({ ...filters, date: e.target.value })}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#8B0000] outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">من الساعة</label>
            <TimePickerInput
              value={filters.start_time}
              onChange={(v) => setFilters({ ...filters, start_time: v })}
              placeholder="00:00"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">إلى الساعة</label>
            <TimePickerInput
              value={filters.end_time}
              onChange={(v) => setFilters({ ...filters, end_time: v })}
              placeholder="00:00"
            />
          </div>
          <button
            type="submit"
            disabled={searching || placesLoading}
            className="w-full bg-[#8B0000] text-white py-2.5 rounded-lg font-bold hover:bg-red-900 transition-colors h-[42px] flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {searching ? <><Loader2 className="w-4 h-4 animate-spin" />جارٍ البحث...</> : 'بحث'}
          </button>
        </form>
      </div>

      {/* RPC Error */}
      {rpcError && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl font-semibold">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {rpcError}
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
        <div className="space-y-8">
          {Object.entries(groupedPlaces).map(([building, bPlaces]) => (
            <div key={building} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-100">
                <h3 className="text-xl font-bold text-gray-900">{building}</h3>
              </div>
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {bPlaces.map((place) => {
                  const isAvailable = availability[place.id] === true;
                  const isChecked   = place.id in availability;

                  return (
                    <div
                      key={place.id}
                      className={`relative flex flex-col justify-between p-4 rounded-xl border-2 transition-all ${
                        !isChecked
                          ? 'border-gray-200 bg-gray-50'
                          : isAvailable
                          ? 'border-green-100 bg-green-50/30 hover:border-green-300'
                          : 'border-red-100 bg-red-50/30 opacity-75'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <p className="font-bold text-gray-900">{place.name}</p>
                          <p className="text-sm text-gray-600">{place.floor}</p>
                        </div>
                        {isChecked && (
                          isAvailable
                            ? <CheckCircle className="w-6 h-6 text-green-500" />
                            : <XCircle className="w-6 h-6 text-red-500" />
                        )}
                      </div>

                      <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-200/50">
                        {isChecked && (
                          <span className={`text-sm font-bold ${isAvailable ? 'text-green-700' : 'text-red-700'}`}>
                            {isAvailable ? 'متاح' : 'محجوز'}
                          </span>
                        )}
                        {isAvailable && (
                          <button
                            onClick={() => handleBookClick(place.id)}
                            className="text-sm bg-white border border-green-200 text-green-700 px-3 py-1 rounded-md hover:bg-green-50 font-semibold"
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
