'use client';

import { ThemeProvider } from 'next-themes';
import { useEffect, useState } from 'react';

export default function ClientThemeProvider({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch by only mounting after client-side render
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Return a placeholder with the same structure
    return <>{children}</>;
  }

  return (
    <ThemeProvider attribute="class">
      {children}
    </ThemeProvider>
  );
}