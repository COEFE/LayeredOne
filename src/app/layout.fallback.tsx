import type { Metadata } from "next";
import "./globals.css";
import AuthWrapper from "../components/AuthWrapper";
import Navigation from "../components/Navigation";
import ErrorDisplay from "../components/ErrorDisplay";
import ClientThemeProvider from "../components/ClientThemeProvider";

// Font fallback that doesn't use next/font
export const metadata: Metadata = {
  title: "Document Chat",
  description: "Chat with AI models and analyze your documents",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Add diagnostic script for troubleshooting 404 errors */}
        <script src="/debug.js" defer></script>
        {/* Load Geist font from CDN as a fallback */}
        <link 
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap" 
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased">
        <ClientThemeProvider>
          <AuthWrapper>
            <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
              <ErrorDisplay />
              <Navigation />
              <main className="flex-1 p-4 md:p-6">{children}</main>
              <footer className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                © {new Date().getFullYear()} DocumentAI Chat. All rights
                reserved.
              </footer>
            </div>
          </AuthWrapper>
        </ClientThemeProvider>
      </body>
    </html>
  );
}