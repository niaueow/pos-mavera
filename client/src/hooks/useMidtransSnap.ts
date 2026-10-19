import { useState, useEffect, useCallback, useRef } from 'react';
import '../types/midtrans';
import { SnapCallbacks } from '../types/midtrans';

const MIDTRANS_SNAP_SCRIPT_ID = 'midtrans-snap-script';
const MIDTRANS_SNAP_URL = 'https://app.sandbox.midtrans.com/snap/snap.js';
const DEFAULT_CLIENT_KEY =
  import.meta.env.VITE_MIDTRANS_CLIENT_KEY || 'Mid-client-4AJ9TDvFKQWStFiy';

/**
 * Dynamically loads the Midtrans Snap sandbox script if not already present.
 */
export function loadSnapScript(clientKey: string = DEFAULT_CLIENT_KEY): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      return resolve();
    }

    if (window.snap) {
      return resolve();
    }

    const existingScript = document.getElementById(MIDTRANS_SNAP_SCRIPT_ID) as HTMLScriptElement | null;
    if (existingScript) {
      if (window.snap) {
        return resolve();
      }
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Gagal memuat script Midtrans Snap')), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.id = MIDTRANS_SNAP_SCRIPT_ID;
    script.src = MIDTRANS_SNAP_URL;
    script.setAttribute('data-client-key', clientKey);
    script.async = true;

    script.onload = () => {
      resolve();
    };

    script.onerror = () => {
      document.head.removeChild(script);
      reject(new Error('Gagal memuat Midtrans Snap Sandbox. Periksa koneksi internet Anda.'));
    };

    document.head.appendChild(script);
  });
}

export interface UseMidtransSnapReturn {
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;
  pay: (snapToken: string, callbacks?: SnapCallbacks) => Promise<void>;
}

export function useMidtransSnap(clientKey: string = DEFAULT_CLIENT_KEY): UseMidtransSnapReturn {
  const [isLoaded, setIsLoaded] = useState<boolean>(() => {
    return typeof window !== 'undefined' && Boolean(window.snap);
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const loadingPromiseRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (window.snap) {
      setIsLoaded(true);
      return;
    }

    setIsLoading(true);
    const promise = loadSnapScript(clientKey);
    loadingPromiseRef.current = promise;

    promise
      .then(() => {
        setIsLoaded(true);
        setError(null);
      })
      .catch((err: Error) => {
        setError(err.message || 'Gagal memuat payment gateway Midtrans');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [clientKey]);

  const pay = useCallback(
    async (snapToken: string, callbacks?: SnapCallbacks): Promise<void> => {
      if (!snapToken || typeof snapToken !== 'string') {
        throw new Error('Snap token tidak valid');
      }

      // If window.snap is not loaded yet, ensure script finishes loading
      if (!window.snap) {
        setIsLoading(true);
        try {
          await loadSnapScript(clientKey);
          setIsLoaded(true);
        } catch (err: any) {
          setError(err.message || 'Gagal memuat Midtrans Snap');
          throw err;
        } finally {
          setIsLoading(false);
        }
      }

      if (!window.snap || typeof window.snap.pay !== 'function') {
        const loadErr = 'Objek Snap tidak tersedia pada window browser';
        setError(loadErr);
        throw new Error(loadErr);
      }

      window.snap.pay(snapToken, callbacks);
    },
    [clientKey]
  );

  return {
    isLoaded,
    isLoading,
    error,
    pay,
  };
}
