import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Write & Speak — English handwriting practice with AI",
  description:
    "Practice writing English vocabulary by hand, get live AI handwriting predictions, spelling feedback and native pronunciation — no sign-up required.",
};

export const viewport: Viewport = {
  themeColor: "#FDFCF7",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
