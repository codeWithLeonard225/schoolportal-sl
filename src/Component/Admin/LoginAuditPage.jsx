import React, { useState, useEffect } from "react";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "../../../firebase";
import {
  FaDesktop,
  FaMobileAlt,
  FaTabletAlt,
  FaGlobeAfrica,
  FaCheckCircle,
  FaTimesCircle,
  FaSearch,
  FaShieldAlt,
} from "react-icons/fa";

const LoginAuditPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // "all" | "success" | "failed"
  const [roleFilter, setRoleFilter] = useState("all");

  useEffect(() => {
    const q = query(
      collection(db, "LoginLogs"),
      orderBy("timestamp", "desc"),
      limit(200)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedLogs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setLogs(fetchedLogs);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching login logs:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const getDeviceIcon = (deviceStr = "") => {
    if (deviceStr.includes("Mobile")) return <FaMobileAlt className="text-indigo-600" />;
    if (deviceStr.includes("Tablet")) return <FaTabletAlt className="text-indigo-600" />;
    return <FaDesktop className="text-indigo-600" />;
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "Just now";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const filteredLogs = logs.filter((log) => {
    const matchesStatus = statusFilter === "all" || log.status === statusFilter;
    const matchesRole = roleFilter === "all" || log.role === roleFilter;
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      !term ||
      log.userName?.toLowerCase().includes(term) ||
      log.userID?.toLowerCase().includes(term) ||
      log.country?.toLowerCase().includes(term) ||
      log.location?.toLowerCase().includes(term) ||
      log.ip?.toLowerCase().includes(term) ||
      log.device?.toLowerCase().includes(term);

    return matchesStatus && matchesRole && matchesSearch;
  });

  const failedCount = logs.filter((l) => l.status === "failed").length;
  const foreignLogins = logs.filter(
    (l) => l.country && l.country !== "Sierra Leone" && l.country !== "Unknown"
  ).length;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <FaShieldAlt className="text-indigo-700" />
              Login Activity & Security Audit
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Real-time log of user logins, devices, IP addresses, and locations.
            </p>
          </div>

          {/* Quick Alert Badges */}
          <div className="flex flex-wrap gap-3">
            <div className="bg-white border border-gray-200 px-4 py-2 rounded-lg shadow-sm">
              <span className="text-xs text-gray-500 block">Total Logged</span>
              <span className="text-lg font-bold text-gray-800">{logs.length}</span>
            </div>
            <div className="bg-red-50 border border-red-200 px-4 py-2 rounded-lg shadow-sm">
              <span className="text-xs text-red-600 block">Failed Attempts</span>
              <span className="text-lg font-bold text-red-700">{failedCount}</span>
            </div>
            <div className="bg-amber-50 border border-amber-200 px-4 py-2 rounded-lg shadow-sm">
              <span className="text-xs text-amber-700 block">Outside Sierra Leone</span>
              <span className="text-lg font-bold text-amber-800">{foreignLogins}</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative md:col-span-2">
            <FaSearch className="absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search name, ID, IP, city, country, or device..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm bg-white focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="success">Successful Logins</option>
            <option value="failed">Failed Attempts</option>
          </select>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm bg-white focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="ceo">CEO</option>
            <option value="teacher">Teacher</option>
            <option value="pupil">Pupil</option>
            <option value="unauthenticated">Unauthenticated (Failed)</option>
          </select>
        </div>

        {/* Logs Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading login records...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No login records match your filter.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-gray-700 text-xs uppercase tracking-wider border-b">
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">User & Role</th>
                    <th className="py-3 px-4">Device & Browser</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4">Country</th>
                    <th className="py-3 px-4">IP / ISP</th>
                    <th className="py-3 px-4">Date & Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-sm">
                  {filteredLogs.map((log) => {
                    const isForeign =
                      log.country &&
                      log.country !== "Sierra Leone" &&
                      log.country !== "Unknown";

                    return (
                      <tr
                        key={log.id}
                        className={`hover:bg-gray-50 transition ${
                          log.status === "failed" ? "bg-red-50/40" : ""
                        }`}
                      >
                        <td className="py-3 px-4 whitespace-nowrap">
                          {log.status === "success" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <FaCheckCircle /> Success
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              <FaTimesCircle /> Failed
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-semibold text-gray-900">{log.userName || "N/A"}</div>
                          <div className="text-xs text-gray-500">
                            ID: <span className="font-mono">{log.userID}</span> •{" "}
                            <span className="uppercase font-semibold text-indigo-600">
                              {log.role}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2 text-gray-800">
                            {getDeviceIcon(log.device)}
                            <span>{log.device}</span>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-gray-700">{log.location}</td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium ${
                              isForeign
                                ? "bg-amber-100 text-amber-800 border border-amber-300"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            <FaGlobeAfrica />
                            {log.country}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-mono text-xs text-gray-800">{log.ip}</div>
                          <div className="text-xs text-gray-500 truncate max-w-[160px]">
                            {log.isp}
                          </div>
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap text-xs text-gray-600">
                          {formatDate(log.timestamp)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginAuditPage;