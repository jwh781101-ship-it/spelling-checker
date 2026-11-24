import './globals.css';

export const metadata = {
  title: '바른 한마디 - 맞춤법·경조사 문구',
  description: '맞춤법은 바르게, 축하와 위로는 알맞게',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '바른 한마디',
  },
  formatDetection: { telephone: false },
};

export const viewport = {
  themeColor: '#6b3d18',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;600;700&family=Noto+Sans+KR:wght@400;500;600&display=swap" rel="stylesheet" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="바른 한마디" />
        <script dangerouslySetInnerHTML={{__html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
              navigator.serviceWorker.register('/jw.js');
            });
          }
        `}} />
      </head>
      <body>{children}</body>
    </html>
  );
}
