import './globals.css';
export const metadata = { title: 'MIS Helpdesk', description: 'School MIS support ticketing system' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
