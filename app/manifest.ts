import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'APK Builder Pro',
    short_name: 'APK Builder',
    description: 'Convert website to Android App',
    start_url: '/',
    display: 'standalone',
    background_color: '#f8f9fa',
    theme_color: '#000000',
    icons: [
      {
        src: '/icon.svg',
        sizes: '192x192',
        type: 'image/svg+xml',
      },
      {
        src: '/icon.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
      },
    ],
  };
}
