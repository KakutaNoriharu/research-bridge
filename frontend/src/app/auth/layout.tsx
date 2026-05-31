export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-primary-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-primary-700">ResearchBridge</h1>
          <p className="mt-1 text-sm text-gray-500">研究と企業をAIでつなぐ</p>
        </div>
        {children}
      </div>
    </div>
  );
}
