import './globals.css';

export const metadata = {
  title: 'AI Project Analysis Tool',
  description: 'Analyze and modify your projects using AI',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}