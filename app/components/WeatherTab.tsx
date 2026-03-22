'use client';
import { useState, useEffect } from 'react';

type CurrentWeather = {
  temp: number;
  feelsLike: number;
  humidity: number;
  precip: number;
  windSpeed: number;
  windDir: string;
  condition: string;
  code: number;
};

type ForecastDay = {
  date: string;
  high: number;
  low: number;
  condition: string;
  precipChance: number;
};

type WeatherData = {
  location: string;
  current: CurrentWeather;
  forecast: ForecastDay[];
};

function weatherIcon(code: number): string {
  if (code === 0) return '☀️';
  if (code <= 2) return '🌤️';
  if (code === 3) return '☁️';
  if (code <= 48) return '🌫️';
  if (code <= 55) return '🌦️';
  if (code <= 65) return '🌧️';
  if (code <= 75) return '❄️';
  if (code <= 82) return '🌧️';
  if (code <= 86) return '🌨️';
  if (code <= 99) return '⛈️';
  return '🌡️';
}

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

export default function WeatherTab() {
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = async () => {
    try {
      const res = await fetch('/api/weather');
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData(json);
      setLastUpdated(new Date());
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 animate-pulse h-48" />
        <div className="grid grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-gray-900 rounded-xl border border-gray-800 p-4 animate-pulse h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-12 text-center text-gray-500">
        Weather data unavailable.
      </div>
    );
  }

  const c = data.current;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Weather</h2>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-gray-600">
              Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button onClick={load} className="text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded-lg transition">
            Refresh
          </button>
        </div>
      </div>

      {/* Current conditions */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-widest font-mono mb-1">{data.location}</p>
            <div className="flex items-end gap-4">
              <span className="text-7xl font-bold text-white tabular-nums">{c.temp}°</span>
              <div className="pb-2">
                <p className="text-xl text-gray-300">{c.condition}</p>
                <p className="text-sm text-gray-500">Feels like {c.feelsLike}°</p>
              </div>
            </div>
          </div>
          <span className="text-6xl">{weatherIcon(c.code)}</span>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mt-6 pt-5 border-t border-gray-800">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-widest font-mono mb-1">Humidity</p>
            <p className="text-lg font-semibold text-cyan-400">{c.humidity}%</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-widest font-mono mb-1">Wind</p>
            <p className="text-lg font-semibold text-cyan-400">{c.windSpeed} mph {c.windDir}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-widest font-mono mb-1">Precip</p>
            <p className="text-lg font-semibold text-cyan-400">{c.precip}&quot;</p>
          </div>
        </div>
      </div>

      {/* 5-day forecast */}
      <div className="grid grid-cols-5 gap-3">
        {data.forecast.map((day) => (
          <div key={day.date} className="bg-gray-900 rounded-xl border border-gray-800 p-4 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-widest font-mono mb-2">{dayLabel(day.date)}</p>
            <span className="text-3xl block mb-2">{weatherIcon(
              day.condition === 'Clear' ? 0 :
              day.condition === 'Mostly Clear' ? 1 :
              day.condition === 'Overcast' ? 3 :
              day.condition === 'Foggy' ? 45 :
              day.condition === 'Drizzle' ? 51 :
              day.condition === 'Rain' ? 61 :
              day.condition === 'Snow' ? 71 :
              day.condition === 'Showers' ? 80 :
              day.condition === 'Snow Showers' ? 85 :
              day.condition === 'Thunderstorm' ? 95 : 0
            )}</span>
            <p className="text-xs text-gray-400 mb-3">{day.condition}</p>
            <div className="flex justify-center gap-2 tabular-nums">
              <span className="text-sm font-bold text-white">{day.high}°</span>
              <span className="text-sm text-gray-600">{day.low}°</span>
            </div>
            {day.precipChance > 0 && (
              <p className="text-xs text-blue-400 mt-1">{day.precipChance}% 💧</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
