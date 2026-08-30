import React, { useState, useEffect, useMemo } from "react";
import { db } from "../../../firebase";
import { pupilLoginFetch } from "../Database/PupilLogin";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { toast } from "react-toastify";
import { useLocation } from "react-router-dom";
import localforage from "localforage";

// 💾 LocalForage Stores
const pupilStore = localforage.createInstance({ name: "PupilDataCache", storeName: "pupil_reg" });
const feesCostStore = localforage.createInstance({ name: "FeesCache", storeName: "fees_cost" });
const receiptStore = localforage.createInstance({ name: "ReceiptsCache", storeName: "receipt_data" });

// 🏷️ Target Master Classes Order
const TARGET_CLASSES = [
  "Nursery 1",
  "Nursery 2",
  "Nursery 3",
  "Prep 1",
  "Prep 2",
  "Prep 3",
  "Prep 4",
  "Prep 5",
  "Prep 6",
];

// 🧹 Extract Master Class (e.g., "Prep 1 A" -> "Prep 1")
const normalizeClass = (rawClass) => {
  if (!rawClass) return null;
  const str = String(rawClass).trim();

  for (const masterClass of TARGET_CLASSES) {
    const regex = new RegExp(`^${masterClass}\\b`, "i");
    if (regex.test(str)) {
      return masterClass;
    }
  }
  return null;
};

// --- HELPER FUNCTION: Outstanding Calculation ---
const calculateOutstanding = (receipts, currentAcademicYear, feeCosts) => {
  const studentMap = {};

  receipts.forEach((r) => {
    if (!studentMap[r.studentID]) {
      studentMap[r.studentID] = {
        studentID: r.studentID,
        studentName: r.studentName,
        subClass: r.class,
        masterClass: normalizeClass(r.class),
        academicYear: r.academicYear,
        totalPaid: 0,
      };
    }
    studentMap[r.studentID].totalPaid += r.amount || 0;
  });

  return Object.values(studentMap)
    .filter((s) => s.masterClass !== null)
    .map((s) => {
      const classFee = feeCosts.find(
        (f) =>
          f.academicYear === s.academicYear &&
          (f.className === s.subClass || normalizeClass(f.className) === s.masterClass)
      );

      // Fallback to 0 if classFee or classFee.totalAmount is undefined
      const totalFee = s.academicYear === currentAcademicYear && classFee ? (Number(classFee.totalAmount) || 0) : 0;
      const totalPaid = Number(s.totalPaid) || 0;

      return {
        ...s,
        totalFee,
        totalPaid,
        outstanding: totalFee - totalPaid,
      };
    });
};

// --- HELPER FUNCTION: Master Class Data ---
const calculateMasterChartData = (pupils) => {
  const masterCounts = {};
  const subClassBreakdown = {};

  TARGET_CLASSES.forEach((cls) => {
    masterCounts[cls] = 0;
    subClassBreakdown[cls] = {};
  });

  pupils.forEach((pupil) => {
    const master = normalizeClass(pupil.class);
    const sub = pupil.class?.trim() || "Unassigned";

    if (master && masterCounts[master] !== undefined) {
      masterCounts[master] += 1;
      subClassBreakdown[master][sub] = (subClassBreakdown[master][sub] || 0) + 1;
    }
  });

  return TARGET_CLASSES.map((cls) => {
    const subDetails = Object.entries(subClassBreakdown[cls])
      .map(([subName, count]) => `${subName}: ${count}`)
      .join(" | ");

    return {
      class: cls,
      pupils: masterCounts[cls],
      subDetails: subDetails || "No sub-classes",
    };
  });
};

// --- HELPER FUNCTION: Sub-Class Data ---
const calculateSubClassChartData = (pupils) => {
  const subCounts = {};

  pupils.forEach((pupil) => {
    const rawClass = pupil.class?.trim();
    if (rawClass && normalizeClass(rawClass) !== null) {
      subCounts[rawClass] = (subCounts[rawClass] || 0) + 1;
    }
  });

  return Object.keys(subCounts)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))
    .map((subName) => ({
      class: subName,
      pupils: subCounts[subName],
      masterClass: normalizeClass(subName),
    }));
};

// Custom Chart Tooltip
const CustomTooltip = ({ active, payload, label, chartView }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 border border-gray-300 rounded shadow-lg text-xs">
        <p className="font-bold text-sm text-blue-900">{label}</p>
        <p className="text-gray-700 font-semibold mb-1">Total Pupils: {data.pupils}</p>
        {chartView === "master" && (
          <div className="border-t pt-1 text-gray-600">
            <p className="font-semibold text-gray-800 mb-0.5">Sub-classes:</p>
            <p>{data.subDetails}</p>
          </div>
        )}
      </div>
    );
  }
  return null;
};

export default function FeesDsahboardJuniorGIA() {
  const [academicYear, setAcademicYear] = useState("");
  const [allYears, setAllYears] = useState([]);
  const [feesOutstanding, setFeesOutstanding] = useState([]);
  const [feesCost, setFeesCost] = useState([]);
  const [allPupils, setAllPupils] = useState([]);
  const [selectedFilterClass, setSelectedFilterClass] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [chartView, setChartView] = useState("subClass"); // Options: 'subClass' or 'master'

  const location = useLocation();
  const schoolId = location.state?.schoolId || "N/A";

  const [loadingPupils, setLoadingPupils] = useState(true);
  const [loadingFeesCost, setLoadingFeesCost] = useState(true);
  const [loadingReceipts, setLoadingReceipts] = useState(true);

  const [outstandingLimit, setOutstandingLimit] = useState(7);
  const [outstandingPage, setOutstandingPage] = useState(1);
  const [pupilsListLimit, setPupilsListLimit] = useState(10);
  const [pupilsPage, setPupilsPage] = useState(1);

  // 1. Fetch Pupils
  useEffect(() => {
    if (!schoolId) return;
    const PUPILS_CACHE_KEY = `pupils_reg_${schoolId}`;

    const loadAndListenPupils = async () => {
      setLoadingPupils(true);

      try {
        const cachedData = await pupilStore.getItem(PUPILS_CACHE_KEY);
        if (cachedData && cachedData.data) {
          const filteredCached = cachedData.data.filter((p) => normalizeClass(p.class) !== null);
          const years = [...new Set(filteredCached.map((p) => p.academicYear))].sort().reverse();
          setAllYears(years);

          if (!academicYear && years.length) {
            const defaultYear = years[0];
            setAcademicYear(defaultYear);

            const pupilsForDefaultYear = filteredCached.filter((p) => p.academicYear === defaultYear);
            setAllPupils(pupilsForDefaultYear);
          }
          setLoadingPupils(false);
        }
      } catch (e) {
        console.error("Cache fetch error:", e);
      }

      const q = query(collection(pupilLoginFetch, "PupilsReg"), where("schoolId", "==", schoolId));
      const unsub = onSnapshot(
        q,
        (snapshot) => {
          const pupils = snapshot.docs
            .map((doc) => ({ id: doc.id, ...doc.data() }))
            .filter((p) => normalizeClass(p.class) !== null);

          const years = [...new Set(pupils.map((p) => p.academicYear))].sort().reverse();
          if (!academicYear && years.length) setAcademicYear(years[0]);

          setAllYears(years);
          pupilStore.setItem(PUPILS_CACHE_KEY, { timestamp: Date.now(), data: pupils });
          setLoadingPupils(false);
        },
        (error) => {
          console.error("Firestore error:", error);
          toast.error("Failed to stream pupil data.");
          setLoadingPupils(false);
        }
      );
      return () => unsub();
    };

    loadAndListenPupils();
  }, [schoolId]);

  // 2. Refresh active academic year pupils
  useEffect(() => {
    if (!academicYear || !schoolId) return;

    const pupilsRef = collection(pupilLoginFetch, "PupilsReg");
    const q = query(
      pupilsRef,
      where("academicYear", "==", academicYear),
      where("schoolId", "==", schoolId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pupils = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((p) => normalizeClass(p.class) !== null);

      setAllPupils(pupils);
    });
    return () => unsubscribe();
  }, [academicYear, schoolId]);

  // 3. Fetch FeesCost
  useEffect(() => {
    if (!schoolId) return;
    const FEES_CACHE_KEY = `fees_cost_${schoolId}`;

    const loadAndListenFees = async () => {
      setLoadingFeesCost(true);
      try {
        const cachedData = await feesCostStore.getItem(FEES_CACHE_KEY);
        if (cachedData && cachedData.data) setFeesCost(cachedData.data);
      } catch (e) {
        console.error("Cache fetch error:", e);
      }

      const q = query(collection(db, "FeesCost"), where("schoolId", "==", schoolId));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const feeList = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
          setFeesCost(feeList);
          feesCostStore.setItem(FEES_CACHE_KEY, { timestamp: Date.now(), data: feeList });
          setLoadingFeesCost(false);
        },
        () => setLoadingFeesCost(false)
      );
      return () => unsubscribe();
    };

    loadAndListenFees();
  }, [schoolId]);

  // 4. Fetch Receipts
  useEffect(() => {
    if (!academicYear || feesCost.length === 0 || !schoolId) return;
    const RECEIPTS_CACHE_KEY = `receipts_${schoolId}_${academicYear}`;

    const loadAndListenReceipts = async () => {
      setLoadingReceipts(true);
      try {
        const cachedData = await receiptStore.getItem(RECEIPTS_CACHE_KEY);
        if (cachedData && cachedData.data) {
          setFeesOutstanding(calculateOutstanding(cachedData.data, academicYear, feesCost));
        }
      } catch (e) {
        console.error("Cache error:", e);
      }

      const q = query(
        collection(db, "Receipts"),
        where("academicYear", "==", academicYear),
        where("schoolId", "==", schoolId)
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const receipts = snapshot.docs.map((doc) => doc.data());
          setFeesOutstanding(calculateOutstanding(receipts, academicYear, feesCost));
          receiptStore.setItem(RECEIPTS_CACHE_KEY, { timestamp: Date.now(), data: receipts });
          setLoadingReceipts(false);
        },
        () => setLoadingReceipts(false)
      );

      return () => unsubscribe();
    };

    loadAndListenReceipts();
  }, [academicYear, feesCost, schoolId]);

  // Dynamic Chart Data based on Toggle
  const activeChartData = useMemo(() => {
    return chartView === "master"
      ? calculateMasterChartData(allPupils)
      : calculateSubClassChartData(allPupils);
  }, [allPupils, chartView]);

  // Merge Pupil Data for Right List
  // Merge Pupil Data for Right List
  const mergedPupilsWithFees = useMemo(() => {
    if (allPupils.length === 0) return [];

    return allPupils.map((pupil) => {
      const masterClass = normalizeClass(pupil.class);
      const subClass = pupil.class;

      const classFee = feesCost.find(
        (f) =>
          f.academicYear === pupil.academicYear &&
          (f.className === subClass || normalizeClass(f.className) === masterClass)
      );

      // Safeguard against missing totalAmount in Firestore documents
      const rawFee = classFee && classFee.totalAmount != null ? classFee.totalAmount : 0;
      const totalFee = Number(rawFee) || 0;

      const receiptData = feesOutstanding.find(
        (r) =>
          r.studentID === pupil.studentID ||
          r.studentName?.toLowerCase() === `${pupil.firstName} ${pupil.lastName}`.toLowerCase()
      );

      // Safeguard against missing or string totalPaid values
      const rawPaid = receiptData && receiptData.totalPaid != null ? receiptData.totalPaid : 0;
      const totalPaid = Number(rawPaid) || 0;

      const outstanding = totalFee - totalPaid;

      return {
        ...pupil,
        subClass,
        masterClass,
        totalFee: totalFee.toFixed(2),
        totalPaid: totalPaid.toFixed(2),
        outstanding: outstanding.toFixed(2),
      };
    });
  }, [allPupils, feesCost, feesOutstanding]);

  // Available Sub-Classes for Dropdown
  const subClassesByMaster = useMemo(() => {
    const map = {};
    TARGET_CLASSES.forEach((cls) => (map[cls] = new Set()));

    mergedPupilsWithFees.forEach((p) => {
      if (p.masterClass && p.subClass) {
        map[p.masterClass]?.add(p.subClass);
      }
    });

    const result = {};
    Object.keys(map).forEach((master) => {
      result[master] = Array.from(map[master]).sort();
    });

    return result;
  }, [mergedPupilsWithFees]);

  // Outstanding Table Calculations
  const filteredOutstanding = feesOutstanding.filter((s) => s.outstanding > 0);
  const totalOutstandingPages = Math.ceil(filteredOutstanding.length / outstandingLimit) || 1;
  const displayedOutstanding = filteredOutstanding
    .slice((outstandingPage - 1) * outstandingLimit, outstandingPage * outstandingLimit)
    .map((s) => ({
      ...s,
      totalFee: Number(s.totalFee).toFixed(2),
      totalPaid: Number(s.totalPaid).toFixed(2),
      outstanding: Number(s.outstanding).toFixed(2),
    }));

  // Right Side List Filtering Logic
  const filteredPupilsList = useMemo(() => {
    return mergedPupilsWithFees.filter((s) => {
      const matchClass = selectedFilterClass
        ? s.subClass === selectedFilterClass || s.masterClass === selectedFilterClass
        : true;

      const term = searchTerm.toLowerCase();
      const matchSearch =
        s.firstName?.toLowerCase().includes(term) ||
        s.lastName?.toLowerCase().includes(term) ||
        s.studentName?.toLowerCase().includes(term) ||
        s.subClass?.toLowerCase().includes(term);

      return matchClass && matchSearch;
    });
  }, [mergedPupilsWithFees, selectedFilterClass, searchTerm]);

  // Gender Breakdown
  const genderBreakdown = useMemo(() => {
    const male = filteredPupilsList.filter((p) => p.gender?.toLowerCase() === "male").length;
    const female = filteredPupilsList.filter((p) => p.gender?.toLowerCase() === "female").length;
    return { male, female, total: filteredPupilsList.length };
  }, [filteredPupilsList]);

  const totalPupilsPages = Math.ceil(filteredPupilsList.length / pupilsListLimit) || 1;
  const displayedPupils = filteredPupilsList.slice(
    (pupilsPage - 1) * pupilsListLimit,
    pupilsPage * pupilsListLimit
  );

  useEffect(() => {
    setPupilsPage(1);
  }, [searchTerm, selectedFilterClass]);

  const overallLoading = loadingPupils || loadingFeesCost || loadingReceipts;

  return (
    <div className="flex flex-col md:flex-row w-full h-screen">
      {/* LEFT SIDE */}
      <div className="hidden md:flex md:w-[70%] flex-col p-4 space-y-4">
        {/* Dynamic Chart Container */}
        <div className="flex-1 bg-red-300 p-4 rounded-lg shadow-md flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-2">
            <div>
              <h1 className="text-xl font-bold">
                Pupils Per Class {chartView === "subClass" ? "(Sub-Class Breakdown)" : "(Master Summary)"}
              </h1>
            </div>

            <div className="flex items-center gap-2">
              {/* Chart Mode Segmented Buttons */}
              <div className="bg-white/80 p-0.5 rounded border border-gray-400 flex text-xs">
                <button
                  onClick={() => setChartView("subClass")}
                  className={`px-2 py-1 rounded font-semibold transition ${chartView === "subClass"
                      ? "bg-blue-600 text-white shadow"
                      : "text-gray-700 hover:bg-gray-100"
                    }`}
                >
                  Sub-Classes
                </button>
                <button
                  onClick={() => setChartView("master")}
                  className={`px-2 py-1 rounded font-semibold transition ${chartView === "master"
                      ? "bg-blue-600 text-white shadow"
                      : "text-gray-700 hover:bg-gray-100"
                    }`}
                >
                  Master Classes
                </button>
              </div>

              {/* Year Selector */}
              <select
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className="p-1 border rounded bg-white text-xs font-semibold"
                disabled={loadingPupils}
              >
                {allYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {activeChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={activeChartData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="class"
                  interval={0}
                  angle={-30}
                  textAnchor="end"
                  tick={{ fontSize: 11 }}
                />
                <YAxis allowDecimals={false} />
                <Tooltip content={<CustomTooltip chartView={chartView} />} />
                <Bar
                  dataKey="pupils"
                  fill={chartView === "subClass" ? "#1d4ed8" : "#2563eb"}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-700 text-center my-auto">
              No pupil data available for {academicYear}.
            </p>
          )}
        </div>

        {/* Fees Outstanding Table */}
        <div className="flex-1 bg-yellow-300 p-4 rounded-lg shadow-md flex flex-col">
          <div className="flex justify-between items-center mb-2">
            <h1 className="text-xl font-bold">Fees Outstanding</h1>
            <select
              value={outstandingLimit}
              onChange={(e) => {
                setOutstandingLimit(Number(e.target.value));
                setOutstandingPage(1);
              }}
              className="p-1 border rounded bg-white text-xs"
            >
              {[5, 7, 10, 15].map((n) => (
                <option key={n} value={n}>
                  {n} per page
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left border-collapse min-w-max text-sm">
              <thead>
                <tr className="bg-yellow-400">
                  <th className="border p-2">Student</th>
                  <th className="border p-2">Sub-Class</th>
                  <th className="border p-2">Master Class</th>
                  <th className="border p-2">Total Fee</th>
                  <th className="border p-2">Paid</th>
                  <th className="border p-2">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {displayedOutstanding.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="border p-4 text-center text-gray-700">
                      {loadingReceipts ? "Calculating fees..." : "No outstanding fees found."}
                    </td>
                  </tr>
                ) : (
                  displayedOutstanding.map((s) => (
                    <tr key={s.studentID} className="bg-white">
                      <td className="border p-2">{s.studentName}</td>
                      <td className="border p-2 font-semibold text-blue-900">{s.subClass}</td>
                      <td className="border p-2 text-gray-600">{s.masterClass}</td>
                      <td className="border p-2">{s.totalFee}</td>
                      <td className="border p-2">{s.totalPaid}</td>
                      <td className="border p-2 text-red-600 font-bold">{s.outstanding}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-center gap-2 mt-2">
            <button
              onClick={() => setOutstandingPage((p) => Math.max(p - 1, 1))}
              disabled={outstandingPage === 1}
              className="px-3 py-1 bg-white rounded shadow disabled:opacity-50 text-sm"
            >
              Prev
            </button>
            <span className="text-sm font-medium">
              Page {outstandingPage} of {totalOutstandingPages}
            </span>
            <button
              onClick={() => setOutstandingPage((p) => Math.min(p + 1, totalOutstandingPages))}
              disabled={outstandingPage === totalOutstandingPages}
              className="px-3 py-1 bg-white rounded shadow disabled:opacity-50 text-sm"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE */}
      <div className="md:w-[30%] bg-blue-300 flex flex-col border-l">
        <div className="p-4 border-b border-blue-400 sticky top-0 bg-blue-300 z-10 flex flex-col gap-2">
          <div className="flex justify-between items-center gap-2">
            <h1 className="text-xl font-bold whitespace-nowrap">Pupil Fees List</h1>

            <select
              value={selectedFilterClass}
              onChange={(e) => {
                setSelectedFilterClass(e.target.value);
                setPupilsPage(1);
              }}
              className="p-1 border rounded bg-white text-black text-xs max-w-[170px] truncate"
            >
              <option value="">All Classes & Sub-Classes</option>

              {TARGET_CLASSES.map((masterClass) => (
                <optgroup key={masterClass} label={`--- ${masterClass} ---`}>
                  <option value={masterClass}>All {masterClass}</option>
                  {subClassesByMaster[masterClass]?.map((sub) => (
                    <option key={sub} value={sub}>
                      ↳ {sub}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <input
            type="text"
            placeholder="Search pupil or sub-class (e.g. Prep 1 A)..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPupilsPage(1);
            }}
            className="p-2 rounded border w-full text-sm"
          />
        </div>

        <div className="p-2 border-b border-blue-400 bg-blue-100 flex justify-between text-sm font-semibold">
          <p>Total: <span className="text-blue-700">{genderBreakdown.total}</span></p>
          <p>Male: <span className="text-blue-700">{genderBreakdown.male}</span></p>
          <p>Female: <span className="text-pink-700">{genderBreakdown.female}</span></p>
        </div>

        <div className="p-2 bg-blue-200 flex items-center gap-2">
          <label className="text-sm">Show:</label>
          <select
            value={pupilsListLimit}
            onChange={(e) => {
              setPupilsListLimit(Number(e.target.value));
              setPupilsPage(1);
            }}
            className="px-2 py-1 rounded border text-sm"
          >
            {[5, 10, 15, 20, 30, 40, 50, 60].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <span className="text-sm">per page</span>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          <table className="min-w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-blue-400 text-black">
                <th className="border p-2">Pupil Name</th>
                <th className="border p-2">Class</th>
                {/* <th className="border p-2">Master Class</th> */}
                <th className="border p-2">Paid</th>
                <th className="border p-2">Bal</th>
              </tr>
            </thead>
            <tbody>
              {displayedPupils.length > 0 ? (
                displayedPupils.map((s) => (
                  <tr key={s.id || s.studentID} className="bg-white hover:bg-blue-50">
                    <td className="border p-2 font-medium">
                      {s.studentName || `${s.firstName} ${s.lastName}`}
                    </td>
                    <td className="border p-2 font-bold text-blue-900">{s.subClass}</td>
                    {/* <td className="border p-2 text-gray-500">{s.masterClass}</td> */}
                    <td className="border p-2">{s.totalPaid}</td>
                    <td
                      className={`border p-2 font-semibold ${s.outstanding > 0 ? "text-red-600" : "text-green-700"
                        }`}
                    >
                      {s.outstanding}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="border p-2 text-center text-gray-700">
                    {overallLoading
                      ? "Loading pupil data..."
                      : `No pupils found${selectedFilterClass ? ` for ${selectedFilterClass}` : ""}.`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-2 border-t border-blue-400 bg-blue-200 flex justify-center items-center gap-3">
          <button
            onClick={() => setPupilsPage((p) => Math.max(p - 1, 1))}
            disabled={pupilsPage === 1}
            className="px-3 py-1 bg-white rounded shadow disabled:opacity-50 text-xs"
          >
            Prev
          </button>
          <span className="text-xs font-medium">
            Page {pupilsPage} of {totalPupilsPages}
          </span>
          <button
            onClick={() => setPupilsPage((p) => Math.min(p + 1, totalPupilsPages))}
            disabled={pupilsPage === totalPupilsPages || totalPupilsPages === 0}
            className="px-3 py-1 bg-white rounded shadow disabled:opacity-50 text-xs"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}