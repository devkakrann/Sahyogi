import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

const urgencyColors = {
  High: "bg-red-500 text-white",
  Medium: "bg-yellow-400 text-gray-900",
  Low: "bg-green-400 text-white",
};

const typeColors = {
  Medical: "from-red-500 to-pink-600",
  Food: "from-orange-400 to-yellow-500",
  Shelter: "from-blue-500 to-indigo-600",
  Rescue: "from-purple-500 to-pink-500",
  Water: "from-cyan-400 to-blue-500",
  Transport: "from-green-500 to-teal-600",
};

function Dashboard() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/requests`)
      .then((res) => res.json())
      .then((data) => {
        setRequests(data);
        setLoading(false);
      });
  }, []);

  const totalPeople = requests.reduce((sum, req) => sum + Number(req.people || 0), 0);
  const totalRequests = requests.length;
  const highUrgency = requests.filter((r) => r.urgency === "High").length;
  const mediumUrgency = requests.filter((r) => r.urgency === "Medium").length;
  const lowUrgency = requests.filter((r) => r.urgency === "Low").length;

  return (
    <div className="rounded-3xl border border-indigo-200 bg-[linear-gradient(180deg,_rgba(255,255,255,0.92),_rgba(239,246,255,0.96))] p-0 shadow-[0_24px_60px_rgba(79,70,229,0.18)]">
      <div className="rounded-t-3xl bg-gradient-to-r from-fuchsia-500 via-violet-500 to-indigo-600 py-4 px-6 flex items-center gap-3 shadow-lg">
        <h2 className="text-3xl font-extrabold text-white tracking-tight">Dashboard</h2>
      </div>

      <div className="bg-gradient-to-r from-yellow-200 to-yellow-400 py-2 px-6 flex items-center gap-2 rounded-b-2xl border-b-4 border-yellow-500">
        <span className="text-lg font-bold text-yellow-800">Summary</span>
      </div>
      <div className="flex flex-wrap justify-center gap-4 mb-6 mt-2 px-4">
        <div className="bg-gradient-to-br from-white to-indigo-50 rounded-xl shadow-md px-6 py-3 flex flex-col items-center border-t-4 border-indigo-400 min-w-[120px]">
          <span className="text-2xl font-bold text-indigo-600">{totalRequests}</span>
          <span className="text-xs text-gray-500">Total Requests</span>
        </div>
        <div className="bg-gradient-to-br from-white to-green-50 rounded-xl shadow-md px-6 py-3 flex flex-col items-center border-t-4 border-green-400 min-w-[120px]">
          <span className="text-2xl font-bold text-green-600">{totalPeople}</span>
          <span className="text-xs text-gray-500">People Helped</span>
        </div>
        <div className="bg-gradient-to-br from-white to-red-50 rounded-xl shadow-md px-6 py-3 flex flex-col items-center border-t-4 border-red-400 min-w-[120px]">
          <span className="text-2xl font-bold text-red-500">{highUrgency}</span>
          <span className="text-xs text-gray-500">High Urgency</span>
        </div>
        <div className="bg-gradient-to-br from-white to-yellow-50 rounded-xl shadow-md px-6 py-3 flex flex-col items-center border-t-4 border-yellow-400 min-w-[120px]">
          <span className="text-2xl font-bold text-yellow-500">{mediumUrgency}</span>
          <span className="text-xs text-gray-500">Medium Urgency</span>
        </div>
        <div className="bg-gradient-to-br from-white to-lime-50 rounded-xl shadow-md px-6 py-3 flex flex-col items-center border-t-4 border-green-300 min-w-[120px]">
          <span className="text-2xl font-bold text-green-500">{lowUrgency}</span>
          <span className="text-xs text-gray-500">Low Urgency</span>
        </div>
      </div>

      <div className="bg-gradient-to-r from-blue-400 to-cyan-300 py-2 px-6 flex items-center gap-2 rounded-t-2xl border-t-4 border-blue-500 mt-6">
        <span className="text-lg font-bold text-blue-900">Requests</span>
      </div>

      {loading ? (
        <div className="bg-gradient-to-r from-gray-200 to-gray-100 py-10 rounded-b-2xl flex flex-col items-center justify-center">
          <p className="text-lg text-gray-500 font-semibold">Loading requests...</p>
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-gradient-to-r from-pink-100 to-pink-200 py-10 rounded-b-2xl text-center text-gray-400">
          <p className="font-semibold">No requests found yet.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-5 bg-gradient-to-br from-blue-50 to-cyan-100 py-6 px-3 rounded-b-2xl">
          {requests.map((req) => (
            <div
              key={req.id}
              className="relative group overflow-hidden rounded-2xl bg-white shadow-xl transition-transform hover:scale-[1.02] hover:shadow-2xl"
            >
              <div className={`bg-gradient-to-r ${typeColors[req.type] || "from-gray-500 to-gray-600"} py-4 px-5 flex items-center justify-between`}>
                <h3 className="text-xl font-bold text-white tracking-wide capitalize">{req.type}</h3>
                <div className={`px-3 py-1 rounded-full text-xs font-bold shadow-md ${urgencyColors[req.urgency] || "bg-gray-300 text-gray-700"}`}>
                  {req.urgency}
                </div>
              </div>

              <div className="bg-gradient-to-b from-white to-slate-50 p-5">
                <p className="text-gray-600 mb-3">
                  <span className="font-semibold text-gray-700">Location:</span> {req.location}
                </p>
                <p className="text-gray-700 mb-3">
                  <span className="font-semibold text-gray-800">People affected:</span> {req.people}
                </p>
                <p className="text-gray-500 mb-4">
                  <span className="font-semibold text-gray-800">Priority Score:</span> {req.priorityScore}/10
                </p>

                <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden mb-3 border border-gray-300">
                  <div
                    className={`h-full rounded-full ${
                      req.priorityScore > 7
                        ? "bg-gradient-to-r from-red-400 to-red-500"
                        : req.priorityScore > 4
                          ? "bg-gradient-to-r from-yellow-400 to-yellow-500"
                          : "bg-gradient-to-r from-green-400 to-green-500"
                    }`}
                    style={{ width: `${Math.min(100, Number(req.priorityScore || 0) * 10)}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Dashboard;
