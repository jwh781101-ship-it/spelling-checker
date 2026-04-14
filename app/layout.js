import './globals.css';

export const metadata = {
  title: '바른 글씨 - 맞춤법 도우미',
  description: '맞춤법과 용례를 바르게',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;600;700&family=Noto+Sans+KR:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
