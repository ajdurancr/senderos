export function DocumentHtml({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      {children}
    </html>
  );
}
