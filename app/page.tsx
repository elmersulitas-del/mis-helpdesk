import EmployeePortal from '@/components/EmployeePortal';
import PwaInstaller from '@/components/PwaInstaller';

export default function HomePage() {
  return (
    <main className="employee-home">
      <PwaInstaller />
      <EmployeePortal />
    </main>
  );
}
