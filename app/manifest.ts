import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'ICC MIS Helpdesk',
    short_name: 'MIS Helpdesk',
    description: 'Submit, track, and reply to ICC MIS support tickets.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f4f7fb',
    theme_color: '#087f76',
    orientation: 'portrait-primary',
    categories: ['business', 'education', 'productivity'],
    icons: [
      {
        src: '/icclogo.png',
        sizes: 'any',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icclogo.png',
        sizes: 'any',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
