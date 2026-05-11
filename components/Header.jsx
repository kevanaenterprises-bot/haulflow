import Link from "next/link";

export default function Header() {
  return (
    <header className="bg-[#111418] border-b border-gray-800">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-3">
        <Link href="/" className="text-2xl font-bold text-blue-500">HaulFlow</Link>
        <nav className="space-x-6 text-sm">
          <Link href="/demo" className="hover:text-blue-400">Demo</Link>
          <Link href="/privacy-policy" className="hover:text-blue-400">Privacy</Link>
        </nav>
      </div>
    </header>
  );
}
