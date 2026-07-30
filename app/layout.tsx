import type { Metadata, Viewport } from 'next';
import './client-complete.css';
import './system-fixes.css';
import './pwa.css';

export const metadata: Metadata = {
  title: {
    default: 'ICC MIS Helpdesk',
    template: '%s | ICC MIS Helpdesk',
  },
  description: 'Immaculada Concepcion College employee MIS support portal',
  applicationName: 'ICC MIS Helpdesk',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icclogo.png',
    apple: '/icclogo.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'MIS Helpdesk',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#087f76',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
