import { useEffect, useState } from "react";
import Layout from "../../components/Layout";

const states = [
  "Created",
  "Dispatched",
  "In Transit",
  "Waiting on Invoicing",
  "Waiting for Payment",
  "Paid",
];

const colors = {
  Created: "text-gray-400",
  Dispatched: "text-blue-400",
  "In Transit": "text-amber-400",
  "Waiting on Invoicing": "text-purple-400",
  "Waiting for Payment": "text-yellow-400",
  Paid: "text-green-400",
};

const sampleCities = ["Atlanta", "Dallas", "Denver", "Chicago", "Houston", "Miami", "Memphis", "Nashville"];

function randomCity() {
  return sampleCities[Math.floor(Math.random() * sampleCities.length)];
}
function randomRate() {
  return (Math.floor(Math.random() * 3000) + 700).toLocaleString();
}

export default function DemoApp() {
  const [loads, setLoads] = useState([]);

  // generate fake loads
  useEffect(() => {
    const initial = Array.from({ length: 8 }).map((_, i) => ({
      id: i + 1,
      origin: randomCity(),
      destination: randomCity(),
      rate: `$${randomRate()}`,
      stage: states[Math.floor(Math.random() * states.length)],
    }));
    setLoads(initial);
  }, []);

  // loop through stages forever
  useEffect(() => {
    const interval = setInterval(() => {
      setLoads((prev) =>
        prev.map((load) => {
          const idx = states.indexOf(load.stage);
          const nextStage = states[(idx + 1) % states.length];
          return { ...load, stage: nextStage };
        })
      );
    }, 3000 + Math.random() * 1500); // stagger timing

    return () => clearInterval(interval);
  }, []);

  return (
    <Layout>
      <section>
        <h1 className="text-3xl font-semibold mb-8 text-blue-400 text-center">
          HaulFlow Dispatch Demo
        </h1>

        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-800 bg-[#1a1d21] rounded-lg text-sm">
            <thead className="bg-[#121417]">
              <tr className="text-left text-gray-400">
                <th className="p-3 border-b border-gray-800">Load #</th>
                <th className="p-3 border-b border-gray-800">Origin</th>
                <th className="p-3 border-b border-gray-800">Destination</th>
                <th className="p-3 border-b border-gray-800">Rate</th>
                <th className="p-3 border-b border-gray-800">Status</th>
              </tr>
            </thead>
            <tbody>
              {loads.map((load) => (
                <tr key={load.id} className="border-b border-gray-800 hover:bg-[#17191c]/60 transition">
                  <td className="p-3 font-mono text-gray-400">{load.id}</td>
                  <td className="p-3">{load.origin}</td>
                  <td className="p-3">{load.destination}</td>
                  <td className="p-3">{load.rate}</td>
                  <td className={`p-3 font-semibold ${colors[load.stage]} transition-all`}>
                    {load.stage}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </Layout>
  );
}
