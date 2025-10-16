import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main style={{ maxWidth: 960, margin: "0 auto", padding: 24 }}>
          {children}
        </main>
        <footer style={{ textAlign: "center", padding: 24, opacity: 0.6 }}>
          © {new Date().getFullYear()} My Sports Facility Admin
        </footer>
      </body>
    </html>
  );
}
