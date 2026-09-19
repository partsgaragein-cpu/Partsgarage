import "./globals.css";

export const metadata = {
  title: "Parts Garage",
  description: "Vehicle & parts inventory management",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
