'use client';

import { useAuthRedirect } from '@/src/hooks/useAuthRedirect';
import { LoginPage } from '@/src/views/auth';

export default function Login() {
  useAuthRedirect();
  return <LoginPage />;
}