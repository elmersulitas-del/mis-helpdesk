import EmployeePortal from '@/components/EmployeePortal';

export default function Home() {
  return (
    <main className="shell">
      <div className="topbar">
        <div>
          <div className="brand">MIS Helpdesk</div>
          <div className="muted">School IT Support Request System</div>
        </div>
        <a href="/mis/login">MIS Staff Login</a>
      </div>
      <EmployeePortal />
    </main>
  );
}
