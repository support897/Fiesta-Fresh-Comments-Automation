"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SwipePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return (
    <div className="flex items-center justify-center h-screen bg-slate-50 text-slate-500 text-sm font-medium">
      Redirecting to Command Center (100% Automated)...
    </div>
  );
}
