import { redirect } from 'next/navigation';
import MisDashboard from '@/components/MisDashboard';
import { isMisAuthenticated } from '@/lib/auth';

export default async function MisPage() {
  if (!(await isMisAuthenticated())) {
    redirect('/mis/login');
  }

  return (
    <main className="mis-page">
      <MisDashboard />
    </main>
  );
}
