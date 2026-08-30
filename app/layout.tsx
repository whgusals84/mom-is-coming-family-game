import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '엄마가 온다! — 코믹 가족 추격 게임',
  description: '사고를 치고 엄마에게 잡히지 않게 도망치는 귀여운 2D 가족 추격 게임',
  applicationName: '엄마가 온다!',
  manifest: '/manifest.webmanifest',
  formatDetection: { telephone: false },
  appleWebApp: {
    capable: true,
    title: '엄마가 온다!',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: '/app-icon-1024.png',
    apple: '/app-icon-1024.png',
  },
  openGraph: {
    title: '엄마가 온다!',
    description: '사고는 크게, 도망은 빠르게! 우당탕탕 가족 추격 게임',
    type: 'website',
    locale: 'ko_KR',
    images: [{
      url: '/og.png',
      width: 1729,
      height: 910,
      alt: '엄마가 온다! 우당탕탕 가족 추격전',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '엄마가 온다!',
    description: '사고는 크게, 도망은 빠르게! 우당탕탕 가족 추격 게임',
    images: ['/og.png'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#ed5b45',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
