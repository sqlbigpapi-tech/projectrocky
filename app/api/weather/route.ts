import { NextResponse } from 'next/server';

const LAT = 26.3384;
const LON = -80.2481;

function wxLabel(code: number): string {
  if (code === 0) return 'Clear';
  if (code <= 2) return 'Mostly Clear';
  if (code === 3) return 'Overcast';
  if (code <= 48) return 'Foggy';
  if (code <= 55) return 'Drizzle';
  if (code <= 65) return 'Rain';
  if (code <= 75) return 'Snow';
  if (code <= 82) return 'Showers';
  if (code <= 86) return 'Snow Showers';
  if (code <= 99) return 'Thunderstorm';
  return 'Unknown';
}

function windDir(deg: number): string {
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(deg / 45) % 8];
}

export async function GET() {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
    `&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
    `&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch` +
    `&timezone=America%2FNew_York&forecast_days=6`;

  const res = await fetch(url, { next: { revalidate: 900 } });
  if (!res.ok) return NextResponse.json({ error: 'Weather unavailable' }, { status: 500 });

  const data = await res.json();
  const c = data.current;
  const d = data.daily;

  return NextResponse.json({
    location: 'Parkland, FL',
    current: {
      temp: Math.round(c.temperature_2m),
      feelsLike: Math.round(c.apparent_temperature),
      humidity: c.relative_humidity_2m,
      precip: c.precipitation,
      windSpeed: Math.round(c.wind_speed_10m),
      windDir: windDir(c.wind_direction_10m),
      condition: wxLabel(c.weather_code),
      code: c.weather_code,
    },
    forecast: (d.time as string[]).slice(1).map((date: string, i: number) => ({
      date,
      high: Math.round(d.temperature_2m_max[i + 1]),
      low: Math.round(d.temperature_2m_min[i + 1]),
      condition: wxLabel(d.weather_code[i + 1]),
      precipChance: d.precipitation_probability_max[i + 1] ?? 0,
    })),
  });
}
