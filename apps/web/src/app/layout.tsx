import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AgentOS",
  description: "Agent task management workspace"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
