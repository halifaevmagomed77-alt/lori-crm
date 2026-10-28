import type { Metadata } from "next";

export const metadata: Metadata = { title: "Табель" };

export default function TabelLayout({ children }: { children: React.ReactNode }) {
  return children;
}
