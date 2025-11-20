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

// 💾 Initialize localforage stores
const pupilStore = localforage.createInstance({
    name: "PupilDataCache",
    storeName: "pupil_reg",
});

const feesCostStore = localforage.createInstance({
    name: "FeesCache",
    storeName: "fees_cost",
});

const receiptStore = localforage.createInstance({
    name: "ReceiptsCache",
    storeName: "receipt_data",
});

// --- HELPER FUNCTION: Outstanding Calculation ---
const calculateOutstanding = (receipts, currentAcademicYear, feeCosts) => {
    const studentMap = {};

    // 1. Map total paid per student from receipts
    receipts.forEach((r) => {
        if (!studentMap[r.studentID]) {
            studentMap[r.studentID] = {
                studentID: r.studentID,
                studentName: r.studentName,
                class: r.class,
                academicYear: r.academicYear,
                totalPaid: 0,
            };
        }
        studentMap[r.studentID].totalPaid += r.amount || 0;
    });

    // 2. Calculate outstanding based on fee costs
    return Object.values(studentMap).map((s) => {
        const classFee = feeCosts.find(
            (f) =>
                f.academicYear === s.academicYear &&
                f.className === s.class
        );
        // Ensure total fee is calculated only for the relevant academic year's fee structure
        const totalFee = (s.academicYear === currentAcademicYear && classFee) ? classFee.totalAmount : 0;
        return {
            ...s,
            totalFee,
            outstanding: totalFee - s.totalPaid,
        };
    });
};

// --- HELPER FUNCTION: Calculate Chart Data ---
const calculatePupilsChartData = (pupils) => {
    const counts = {};
    pupils.forEach((pupil) => {
        const cls = pupil.class || "Unknown";
        counts[cls] = (counts[cls] || 0) + 1;
    });
    return Object.keys(counts).sort().map((cls) => ({
        class: cls,
        pupils: counts[cls],
    }));
};


export default function FeesDashboard() {
  const [pupilsData, setPupilsData] = useState([]); // For chart
  const [academicYear, setAcademicYear] = useState("");
  const [allYears, setAllYears] = useState([]);
  const [feesOutstanding, setFeesOutstanding] = useState([]);
  const [feesCost, setFeesCost] = useState([]);
  const [allPupils, setAllPupils] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const location = useLocation();
  const schoolId = location.state?.schoolId || "N/A";

  // Loading States
  const [loadingPupils, setLoadingPupils] = useState(true);
  const [loadingFeesCost, setLoadingFeesCost] = useState(true);
  const [loadingReceipts, setLoadingReceipts] = useState(true);

  // Pagination states
  const [outstandingLimit, setOutstandingLimit] = useState(7);
  const [outstandingPage, setOutstandingPage] = useState(1);
  const [pupilsListLimit, setPupilsListLimit] = useState(10);
  const [pupilsPage, setPupilsPage] = useState(1);


// 1. 📚 PupilsReg & Academic Years (Cached and Real-Time) - OPTIMIZED FOR CACHE-FIRST DISPLAY
useEffect(() => {
    if (!schoolId) return;
    const PUPILS_CACHE_KEY = `pupils_reg_${schoolId}`;

    const loadAndListenPupils = async () => {
        setLoadingPupils(true);
        let defaultYear = "";
        let initialPupils = [];

        // 1. Load from cache (Cache-First Read for instant display)
        try {
            const cachedData = await pupilStore.getItem(PUPILS_CACHE_KEY);
            if (cachedData && cachedData.data) {
                initialPupils = cachedData.data;
                const years = [...new Set(initialPupils.map((p) => p.academicYear))].sort().reverse();
                setAllYears(years);
                
                // ⭐️ Set initial year, pupil list, and chart data from cache ⭐️
                defaultYear = years.length ? years[0] : "";
                if (!academicYear && defaultYear) {
                    setAcademicYear(defaultYear);
                    
                    const pupilsForDefaultYear = initialPupils.filter(p => p.academicYear === defaultYear);
                    setAllPupils(pupilsForDefaultYear); // Sets the list for the Right Side
                    
                    const chartData = calculatePupilsChartData(pupilsForDefaultYear);
                    setPupilsData(chartData); // Sets the data for the Left Side Chart
                    
                    console.log("Loaded pupils and initial dashboard view from cache.");
                }
                setLoadingPupils(false); // Immediate loading off for cache hit
            }
        } catch (e) {
            console.error("Failed to retrieve cached pupils:", e);
        }

        // 2. Set up Firestore Listener (Runs in the background to sync and update cache)
        const q = query(collection(pupilLoginFetch, "PupilsReg"), where("schoolId", "==", schoolId));
        const unsub = onSnapshot(q, (snapshot) => {
            const pupils = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            const years = [...new Set(pupils.map((p) => p.academicYear))].sort().reverse();
            
            // Only set academic year if it was never set (i.e., first load or cache miss)
            if (!academicYear && years.length) setAcademicYear(years[0]);
            
            setAllYears(years);

            // 3. Save fresh data to localforage
            pupilStore.setItem(PUPILS_CACHE_KEY, { timestamp: Date.now(), data: pupils })
                .catch(e => console.error("Failed to save pupils to IndexDB:", e));
            
            setLoadingPupils(false);
        }, (error) => {
            console.error("Firestore 'PupilsReg' onSnapshot failed:", error);
            toast.error("Failed to stream pupil data.");
            setLoadingPupils(false);
        });
        return () => unsub();
    };

    loadAndListenPupils();
}, [schoolId]); 


// 2. 📊 Pupils Per Class chart & Full Pupil List for Selected Year 
// This runs whenever academicYear changes (or on initial load via state update in useEffect 1)
useEffect(() => {
    if (!academicYear || !schoolId) return;

    const pupilsRef = collection(pupilLoginFetch, "PupilsReg");
    const q = query(
      pupilsRef,
      where("academicYear", "==", academicYear),
      where("schoolId", "==", schoolId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pupils = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setAllPupils(pupils);
      
      // Calculate and set chart data based on the newly fetched/cached data
      const chartData = calculatePupilsChartData(pupils);
      setPupilsData(chartData);
    });
    return () => unsubscribe();
}, [academicYear, schoolId]);

// 3. 💰 Fetch FeesCost (Cached and Real-Time)
useEffect(() => {
    if (!schoolId) return;
    const FEES_CACHE_KEY = `fees_cost_${schoolId}`;

    const loadAndListenFees = async () => {
        setLoadingFeesCost(true);
        
        // 1. Load from cache
        try {
            const cachedData = await feesCostStore.getItem(FEES_CACHE_KEY);
            if (cachedData && cachedData.data) {
                setFeesCost(cachedData.data);
                console.log("Loaded fees cost from cache.");
            }
        } catch (e) {
            console.error("Failed to retrieve cached fees cost:", e);
        }

        // 2. Set up Firestore Listener
        const feesCollectionRef = collection(db, "FeesCost");
        const q = query(feesCollectionRef, where("schoolId", "==", schoolId));
        const unsubscribeFees = onSnapshot(
            q,
            (snapshot) => {
                const feeList = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
                setFeesCost(feeList);

                // 3. Save fresh data to localforage
                feesCostStore.setItem(FEES_CACHE_KEY, { timestamp: Date.now(), data: feeList })
                    .catch(e => console.error("Failed to save fees cost to IndexDB:", e));
                
                setLoadingFeesCost(false);
            },
            (error) => {
                console.error("Firestore 'FeesCost' onSnapshot failed:", error);
                toast.error("Failed to load fee structures.");
                setLoadingFeesCost(false);
            }
        );
        return () => unsubscribeFees();
    };

    loadAndListenFees();
}, [schoolId]);

// 4. 🧾 Fetch Receipts & Calculate Outstanding (Cached and Real-Time)
useEffect(() => {
    if (!academicYear || feesCost.length === 0 || !schoolId) return;
    const RECEIPTS_CACHE_KEY = `receipts_${schoolId}_${academicYear}`;
    
    const loadAndListenReceipts = async () => {
        setLoadingReceipts(true);
        
        // 1. Load from cache
        try {
            const cachedData = await receiptStore.getItem(RECEIPTS_CACHE_KEY);
            if (cachedData && cachedData.data) {
                // Run calculation on cached data
                const result = calculateOutstanding(cachedData.data, academicYear, feesCost);
                setFeesOutstanding(result);
                console.log("Loaded receipts from cache and calculated outstanding.");
            }
        } catch (e) {
            console.error("Failed to retrieve cached receipts:", e);
        }

        // 2. Set up Firestore Listener
        const receiptsRef = collection(db, "Receipts");
        const q = query(
            receiptsRef,
            where("academicYear", "==", academicYear),
            where("schoolId", "==", schoolId)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const receipts = snapshot.docs.map((doc) => doc.data());
            
            // Recalculate outstanding based on fresh data
            const result = calculateOutstanding(receipts, academicYear, feesCost);
            setFeesOutstanding(result);

            // 3. Save fresh data to localforage
            receiptStore.setItem(RECEIPTS_CACHE_KEY, { timestamp: Date.now(), data: receipts })
                .catch(e => console.error("Failed to save receipts to IndexDB:", e));
            
            setLoadingReceipts(false);
        }, (error) => {
            console.error("Firestore 'Receipts' onSnapshot failed:", error);
            toast.error("Failed to stream receipt data.");
            setLoadingReceipts(false);
        });

        return () => unsubscribe();
    };

    loadAndListenReceipts();
}, [academicYear, feesCost, schoolId]);


  // --- Merge Pupils with Fees and Receipts ---
  const mergedPupilsWithFees = useMemo(() => {
    if (allPupils.length === 0) return [];

    return allPupils.map((pupil) => {
      const classFee = feesCost.find(
        (f) => f.academicYear === pupil.academicYear && f.className === pupil.class
      );
      const totalFee = classFee ? classFee.totalAmount : 0;

      // Find the paid/outstanding data from the calculated feesOutstanding state
      const receiptData = feesOutstanding.find(
        (r) =>
          r.studentID === pupil.studentID ||
          r.studentName?.toLowerCase() ===
            `${pupil.firstName} ${pupil.lastName}`.toLowerCase()
      );

      const totalPaid = receiptData ? receiptData.totalPaid : 0;
      const outstanding = totalFee - totalPaid;

      return {
        ...pupil,
        totalFee: totalFee.toFixed(2),
        totalPaid: totalPaid.toFixed(2),
        outstanding: outstanding.toFixed(2),
      };
    });
  }, [allPupils, feesCost, feesOutstanding]);

  // --- Filter class options ---
  const allClasses = useMemo(() => {
    return [...new Set(allPupils.map((s) => s.class))].filter(Boolean).sort();
  }, [allPupils]);

  // --- Filtered Outstanding (Left Side Table) ---
  const filteredOutstanding = feesOutstanding.filter((s) => s.outstanding > 0);
  const totalOutstandingPages =
    Math.ceil(filteredOutstanding.length / outstandingLimit) || 1;
  const displayedOutstanding = filteredOutstanding.slice(
    (outstandingPage - 1) * outstandingLimit,
    outstandingPage * outstandingLimit
  ).map(s => ({
    ...s,
    totalFee: s.totalFee.toFixed(2),
    totalPaid: s.totalPaid.toFixed(2),
    outstanding: s.outstanding.toFixed(2),
  }));

  // --- Filtered Pupils for right side (by class + search) ---
  const filteredPupilsList = useMemo(() => {
    return mergedPupilsWithFees.filter((s) => {
      const matchClass = selectedClass ? s.class === selectedClass : true;
      const term = searchTerm.toLowerCase();
      
      const matchSearch =
        s.firstName?.toLowerCase().includes(term) ||
        s.lastName?.toLowerCase().includes(term) ||
        s.studentName?.toLowerCase().includes(term) ||
        s.class?.toLowerCase().includes(term);
        
      return matchClass && matchSearch;
    });
  }, [mergedPupilsWithFees, selectedClass, searchTerm]);

  // --- Gender Breakdown ---
  const genderBreakdown = useMemo(() => {
    const male = filteredPupilsList.filter(
      (p) => p.gender?.toLowerCase() === "male"
    ).length;
    const female = filteredPupilsList.filter(
      (p) => p.gender?.toLowerCase() === "female"
    ).length;
    return { male, female, total: filteredPupilsList.length };
  }, [filteredPupilsList]);

  // --- Pagination for Pupils List ---
  const totalPupilsPages = Math.ceil(filteredPupilsList.length / pupilsListLimit) || 1;
  const displayedPupils = filteredPupilsList.slice(
    (pupilsPage - 1) * pupilsListLimit,
    pupilsPage * pupilsListLimit
  );

  // --- Reset page when search/class changes ---
  useEffect(() => {
    setPupilsPage(1);
  }, [searchTerm, selectedClass]);
  
  const overallLoading = loadingPupils || loadingFeesCost || loadingReceipts;


  return (
    <div className="flex flex-col md:flex-row w-full h-screen">
      
      {/* LEFT SIDE */}
      <div className="hidden md:flex md:w-[70%] flex-col p-4 space-y-4">
        {/* Loading Indicator */}
        {overallLoading && (
            <div className="p-2 text-center text-lg text-blue-600 font-semibold bg-blue-100 rounded-lg">
                Loading data from cache or server...
            </div>
        )}
        
        {/* Pupils Per Class */}
        <div className="flex-1 bg-red-300 p-4 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-xl font-bold">Pupils Per Class</h1>
            <select
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="p-1 border rounded"
              disabled={loadingPupils}
            >
              {allYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          {pupilsData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={pupilsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="class" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="pupils" fill="#2563eb" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-700">No pupil data for {academicYear}.</p>
          )}
        </div>

        {/* Fees Outstanding */}
        <div className="flex-1 bg-yellow-300 p-4 rounded-lg shadow-md flex flex-col">
          <div className="flex justify-between items-center mb-2">
            <h1 className="text-xl font-bold">Fees Outstanding</h1>
            <select
              value={outstandingLimit}
              onChange={(e) => {
                setOutstandingLimit(Number(e.target.value));
                setOutstandingPage(1);
              }}
              className="p-1 border rounded bg-white"
            >
              {[5, 7, 10, 15].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left border-collapse min-w-max">
              <thead>
                <tr>
                  <th className="border p-2">Student</th>
                  <th className="border p-2">Class</th>
                  <th className="border p-2">Total Fee</th>
                  <th className="border p-2">Paid</th>
                  <th className="border p-2">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {displayedOutstanding.length === 0 ? (
                    <tr>
                        <td colSpan={5} className="border p-4 text-center text-gray-700">
                            {loadingReceipts ? "Calculating fees..." : "No outstanding fees found."}
                        </td>
                    </tr>
                ) : (
                    displayedOutstanding.map((s) => (
                        <tr key={s.studentID} className="bg-white">
                            <td className="border p-2">{s.studentName}</td>
                            <td className="border p-2">{s.class}</td>
                            <td className="border p-2">{s.totalFee}</td>
                            <td className="border p-2">{s.totalPaid}</td>
                            <td className="border p-2 text-red-600">{s.outstanding}</td>
                        </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex justify-center gap-2 mt-2">
            <button
              onClick={() => setOutstandingPage((p) => Math.max(p - 1, 1))}
              disabled={outstandingPage === 1}
              className="px-3 py-1 bg-white rounded shadow disabled:opacity-50"
            >
              Prev
            </button>
            <span className="text-sm font-medium">
              Page {outstandingPage} of {totalOutstandingPages}
            </span>
            <button
              onClick={() =>
                setOutstandingPage((p) => Math.min(p + 1, totalOutstandingPages))
              }
              disabled={outstandingPage === totalOutstandingPages}
              className="px-3 py-1 bg-white rounded shadow disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE */}
      <div className="md:w-[30%] bg-blue-300 flex flex-col border-l">
        <div className="p-4 border-b border-blue-400 sticky top-0 bg-blue-300 z-10 flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold">Pupil Fees List</h1>
            <select
              value={selectedClass}
              onChange={(e) => {
                setSelectedClass(e.target.value);
                setPupilsPage(1);
              }}
              className="p-1 border rounded bg-white text-black"
            >
              <option value="">All Classes</option>
              {allClasses.map((cls) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </select>
          </div>

          {/* Search Filter */}
          <input
            type="text"
            placeholder="Search pupil or class..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPupilsPage(1);
            }}
            className="p-2 rounded border w-full text-sm"
          />
        </div>

        {/* Gender Summary */}
        <div className="p-2 border-b border-blue-400 bg-blue-100 sticky top-[108px] z-10 flex justify-between text-sm font-semibold">
          <p>Total: <span className="text-blue-700">{genderBreakdown.total}</span></p>
          <p>Male: <span className="text-blue-700">{genderBreakdown.male}</span></p>
          <p>Female: <span className="text-pink-700">{genderBreakdown.female}</span></p>
        </div>

        {/* Limit */}
        <div className="p-2 bg-blue-200 sticky top-[144px] z-10 flex items-center gap-2">
          <label className="text-sm">Show:</label>
          <select
            value={pupilsListLimit}
            onChange={(e) => {
              setPupilsListLimit(Number(e.target.value));
              setPupilsPage(1);
            }}
            className="px-2 py-1 rounded border"
          >
            {[5, 10, 15, 20, 30, 40, 50, 60].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <span className="text-sm">per page</span>
        </div>

        {/* Pupils Table */}
        <div className="flex-1 overflow-y-auto p-4">
          <table className="min-w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="border p-2">Pupil Name</th>
                <th className="border p-2">Class</th>
                <th className="border p-2">Paid</th>
                <th className="border p-2">Bal</th>
              </tr>
            </thead>
            <tbody>
              {displayedPupils.length > 0 ? (
                displayedPupils.map((s) => (
                  <tr key={s.id || s.studentID} className="bg-white">
                    <td className="border p-2">
                      {s.studentName || `${s.firstName} ${s.lastName}`}
                    </td>
                    <td className="border p-2">{s.class}</td>
                    <td className="border p-2">{s.totalPaid}</td>
                    <td
                      className={`border p-2 ${
                        s.outstanding > 0 ? "text-red-600 font-semibold" : "text-green-700"
                      }`}
                    >
                      {s.outstanding}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    className="border p-2 text-center text-gray-700"
                  >
                    {overallLoading ? "Loading pupil data..." : `No pupils found${selectedClass ? ` in ${selectedClass}` : ""}.`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-2 border-t border-blue-400 bg-blue-200 flex justify-center items-center gap-3">
          <button
            onClick={() => setPupilsPage((p) => Math.max(p - 1, 1))}
            disabled={pupilsPage === 1}
            className="px-3 py-1 bg-white rounded shadow disabled:opacity-50"
          >
            Prev
          </button>
          <span className="text-sm font-medium">
            Page {pupilsPage} of {totalPupilsPages}
          </span>
          <button
            onClick={() =>
              setPupilsPage((p) => Math.min(p + 1, totalPupilsPages))
            }
            disabled={pupilsPage === totalPupilsPages || totalPupilsPages === 0}
            className="px-3 py-1 bg-white rounded shadow disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}