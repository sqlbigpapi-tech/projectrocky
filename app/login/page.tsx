'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [digits, setDigits] = useState(['', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const router = useRouter();

  async function submit(pin: string) {
    setLoading(true);
    setError('');
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });
    if (res.ok) {
      router.push('/');
      router.refresh();
    } else {
      setError('Incorrect PIN');
      setDigits(['', '', '', '']);
      setLoading(false);
      inputs.current[0]?.focus();
    }
  }

  function handleChange(i: number, val: string) {
    if (!/^\d?$/.test(val)) return;
    const next = [...digits];
    next[i] = val;
    setDigits(next);
    setError('');
    if (val && i < 3) {
      inputs.current[i + 1]?.focus();
    }
    if (val && i === 3) {
      const pin = next.join('');
      if (pin.length === 4) submit(pin);
    }
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputs.current[i - 1]?.focus();
    }
  }

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center gap-8">
      <div className="text-center">
        <p className="text-xs text-amber-400 uppercase tracking-[0.3em] font-mono mb-1">David Ortiz</p>
        <h1 className="text-2xl font-bold text-white tracking-tight">Project Rocky</h1>
      </div>

      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-8 flex flex-col items-center gap-6 w-72">
        <p className="text-xs text-zinc-500 uppercase tracking-widest font-mono">Enter PIN</p>

        <div className="flex gap-3">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={el => { inputs.current[i] = el; }}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              autoFocus={i === 0}
              className={`w-12 h-14 text-center text-xl font-bold font-mono bg-zinc-900 border rounded-xl text-white outline-none transition
                ${error ? 'border-red-500' : d ? 'border-amber-500' : 'border-zinc-700'}
                focus:border-amber-400`}
            />
          ))}
        </div>

        {error && <p className="text-xs text-red-400 font-mono">{error}</p>}
        {loading && <p className="text-xs text-zinc-600 font-mono">Verifying…</p>}
      </div>
    </main>
  );
}
