'use client';
import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    TellerConnect: {
      setup: (config: {
        applicationId: string;
        environment?: string;
        onSuccess: (enrollment: { accessToken: string }) => void;
        onExit?: () => void;
      }) => { open: () => void };
    };
  }
}

export default function TellerConnectButton({
  onSuccess,
  label = 'Connect a Bank Account',
}: {
  onSuccess: (token: string) => void;
  label?: string;
}) {
  const connectRef = useRef<{ open: () => void } | null>(null);
  const ready = useRef(false);

  useEffect(() => {
    const existing = document.getElementById('teller-connect-script');
    if (existing) {
      if (window.TellerConnect) initConnect();
      return;
    }

    const script = document.createElement('script');
    script.id = 'teller-connect-script';
    script.src = 'https://cdn.teller.io/connect/connect.js';
    script.onload = initConnect;
    document.head.appendChild(script);
  }, []);

  function initConnect() {
    connectRef.current = window.TellerConnect.setup({
      applicationId: process.env.NEXT_PUBLIC_TELLER_APP_ID!,
      environment: process.env.NEXT_PUBLIC_TELLER_ENV ?? 'development',
      onSuccess: (enrollment) => onSuccess(enrollment.accessToken),
    });
    ready.current = true;
  }

  return (
    <button
      onClick={() => connectRef.current?.open()}
      className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-5 py-2.5 rounded-lg transition text-sm"
    >
      + {label}
    </button>
  );
}
