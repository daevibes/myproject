'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  const currentAccount = useCurrentAccount();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.replace('/game');
    });
  }, []);

  useEffect(() => {
    if (!currentAccount) return;
    handleSuiLogin(currentAccount.address);
  }, [currentAccount]);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  const handleSuiLogin = async (walletAddress: string) => {
    setLoading(true);
    setError('');

    try {
      const { data, error: anonError } = await supabase.auth.signInAnonymously();
      if (anonError) throw anonError;

      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          sui_wallet_address: walletAddress,
          display_name: `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`,
        });
      }

      router.replace('/game');
    } catch (err: any) {
      setError(err.message || 'Sui 지갑 로그인 실패');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-indigo-950 to-gray-900">
      <div className="w-full max-w-md p-8 rounded-2xl bg-gray-800/80 backdrop-blur shadow-2xl border border-gray-700">
        <h1 className="text-3xl font-bold text-center text-white mb-2">
          Survivor Game
        </h1>
        <p className="text-center text-gray-400 mb-8">로그인하여 게임을 시작하세요</p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 text-sm text-center">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-6 py-3 rounded-xl bg-white text-gray-800 font-semibold hover:bg-gray-100 transition disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Google로 로그인
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-600" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-gray-800 text-gray-400">또는</span>
            </div>
          </div>

          <div className="flex justify-center [&_button]:!w-full [&_button]:!py-3 [&_button]:!rounded-xl [&_button]:!font-semibold">
            <ConnectButton />
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-gray-500">
          Sui 지갑 연결은 NFT 내보내기용으로 사용됩니다.
          <br />
          게임 플레이만 하려면 Google 로그인을 이용하세요.
        </p>
      </div>
    </div>
  );
}
