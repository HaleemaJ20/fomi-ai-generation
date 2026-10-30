import { Inter } from 'next/font/google';
import './globals.css';
import ThemeProvider from '../components/providers/ThemeProvider';
import AppShell from '../components/layout/AppShell';
import { GenerationProvider } from '../context/GenerationContext';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

export const metadata = {
  title: 'Fomi',
  description: 'AI image and video generation studio',
  openGraph: {
    title: 'Fomi',
    description: 'AI image and video generation studio',
  },
};

export const viewport = {
  themeColor: '#e8a08c',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: "try{var t=localStorage.getItem('fomi-theme');if(!t)t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.classList.toggle('dark',t==='dark')}catch(e){}",
          }}
        />
      </head>
      <body className={inter.variable}>
        <ThemeProvider>
          <GenerationProvider>
            <AppShell>{children}</AppShell>
          </GenerationProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}