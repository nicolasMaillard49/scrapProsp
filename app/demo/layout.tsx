export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <link
        href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Space+Mono:wght@400;700&display=swap"
        rel="stylesheet"
      />
      <style>{`body { margin: 0; padding: 0; }`}</style>
      {children}
    </div>
  );
}
