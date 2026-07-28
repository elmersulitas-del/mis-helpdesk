import { redirect } from 'next/navigation';
import LoginForm from '@/components/LoginForm';
import { isMisAuthenticated } from '@/lib/auth';

export default async function MisLoginPage() {
  if (await isMisAuthenticated()) {
    redirect('/mis');
  }

  return (
    <main className="mis-login-page">
      <LoginForm />
    </main>
  );
}
