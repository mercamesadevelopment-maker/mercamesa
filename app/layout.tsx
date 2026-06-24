import './globals.css';
import { AppProvider } from '../src/store';
import AppShell from './app-shell';

export const metadata = {
  title: 'MercaMesa',
  description: 'MercaMesa App',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AppProvider>
          <AppShell>
            {children}
          </AppShell>
        </AppProvider>
      </body>
    </html>
  );
}
