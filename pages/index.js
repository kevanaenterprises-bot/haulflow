import Link from "next/link";
import Layout from "../components/Layout";

export default function Home() {
  return (
    <Layout>
      <section className="flex flex-col items-center justify-center text-center py-20">
        <h1 className="text-5xl font-bold mb-4 text-blue-400">
          Dispatch smarter. Get paid faster.
        </h1>
        <p className="text-lg text-gray-300 max-w-2xl mb-8">
          HaulFlow keeps your loads, drivers, and cashflow in motion — 
          from first dispatch to final payment.
        </p>
        <Link
          href="/demo"
          className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-8 py-3 rounded-md transition-colors"
        >
          Request a Demo
        </Link>
      </section>

      <section className="grid md:grid-cols-3 gap-8 mt-20 text-left">
        <div className="bg-[#1a1d21] p-6 rounded-lg border border-gray-800">
          <h3 className="text-blue-400 font-semibold mb-2">Dispatch</h3>
          <p className="text-gray-400 text-sm">
            Manage and track every load from creation to delivery in real time.
          </p>
        </div>

        <div className="bg-[#1a1d21] p-6 rounded-lg border border-gray-800">
          <h3 className="text-blue-400 font-semibold mb-2">Finance</h3>
          <p className="text-gray-400 text-sm">
            Invoicing and payments flow automatically once loads are completed.
          </p>
        </div>

        <div className="bg-[#1a1d21] p-6 rounded-lg border border-gray-800">
          <h3 className="text-blue-400 font-semibold mb-2">Visibility</h3>
          <p className="text-gray-400 text-sm">
            Every driver, document, and route connected in one dashboard.
          </p>
        </div>
      </section>
    </Layout>
  );
}
