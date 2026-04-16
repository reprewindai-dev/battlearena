import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/app/', '/api/', '/auth/'],
      },
    ],
    sitemap: 'https://spitzone.com/sitemap.xml',
    host: 'https://spitzone.com',
  };
}
