import { Inter } from 'next/font/google';
import './studio.css';
import { StudioProvider } from '@/context/studio/StudioContext';

const inter = Inter({ subsets: ['latin'] });

export default function StudioLayout({ children }) {
  return (
    <div className={`${inter.className} studio-root`}>
      <StudioProvider>{children}</StudioProvider>
    </div>
  );
}
