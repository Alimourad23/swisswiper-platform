import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SwissWiper",
  description: "The SwissWiper performance platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Satoshi — the SwissWiper brand typeface — served from Fontshare. */}
        <link rel="preconnect" href="https://api.fontshare.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=satoshi@300,400,500,700&display=swap"
        />
      </head>
      <body className="min-h-screen bg-sw-white text-sw-black font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
