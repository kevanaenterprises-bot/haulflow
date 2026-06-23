export default function Footer() {
  return (
    <footer className="bg-[#111418] text-center text-gray-400 text-xs py-6 mt-10 border-t border-gray-800">
      <p>© {new Date().getFullYear()} HaulFlow. All rights reserved.</p>
      <div className="flex items-center justify-center gap-3 mt-2 text-xs text-gray-500">
        <a href="https://haulflow.turtlelogisticsllc.com/privacy.html" target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 transition">Privacy Policy</a>
        <span className="text-gray-700">·</span>
        <a href="https://haulflow.turtlelogisticsllc.com/terms.html" target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 transition">Terms of Service</a>
      </div>
    </footer>
  );
}
