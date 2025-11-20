import React, { useEffect, useState, useMemo } from "react";
import { db } from "../../../firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { useLocation } from "react-router-dom";
import localforage from "localforage"; // ⬅️ Import localforage

// Initialize localforage store
const assignmentsStore = localforage.createInstance({
    name: "TeacherAssignmentsCache",
    storeName: "assignmentsData",
});

const TeacherAssignmentReport = () => {
    const location = useLocation();
    const schoolId = location.state?.schoolId || "N/A";

    const [assignments, setAssignments] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true); // ⬅️ Added loading state

    // --- Configuration ---
    const LOCALFORAGE_KEY = `assignments_${schoolId}`;
    // ---------------------

    // --- Helper Function ---
    // Function to sort the class list alphabetically
    const sortClassesAlphabetically = (classList) => {
        return [...classList].sort((a, b) => a.className.localeCompare(b.className));
    };
    // -------------------------

    // 1. Load from IndexDB Cache and Set up Real-Time onSnapshot
    useEffect(() => {
        if (schoolId === "N/A") {
            setLoading(false);
            return;
        }

        const loadAndListen = async () => {
            setLoading(true);

            // 🚀 Step 1: Attempt to load from localforage cache (FAST initial load)
            try {
                const cachedItem = await assignmentsStore.getItem(LOCALFORAGE_KEY);
                if (cachedItem && cachedItem.data && cachedItem.data.length > 0) {
                    setAssignments(cachedItem.data);
                    setLoading(false); // Initial load complete via cache
                    console.log("Loaded initial assignments from IndexDB cache.");
                }
            } catch (e) {
                console.error("Failed to retrieve cached assignments:", e);
                // Continue to Firebase fetch if cache fails
            }

            // 🚀 Step 2: Set up Firestore Listener (Starts immediately)
            const q = query(collection(db, "TeacherAssignments"), where("schoolId", "==", schoolId));

            const unsub = onSnapshot(
                q,
                (snapshot) => {
                    const fetchedData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
                    
                    // Update UI state with new data
                    setAssignments(fetchedData);

                    // 🚀 Step 3: Save fresh data to localforage
                    const dataToStore = {
                        timestamp: Date.now(),
                        data: fetchedData,
                    };
                    assignmentsStore.setItem(LOCALFORAGE_KEY, dataToStore)
                        .catch(e => console.error("Failed to save assignments to IndexDB:", e));

                    setLoading(false); // Loading is done once the first snapshot arrives (or cache loaded)
                    console.log("Assignments updated via real-time Firestore listener.");
                },
                (error) => {
                    console.error("Failed to fetch assignments from Firestore:", error);
                    setLoading(false);
                }
            );

            return () => unsub(); // Cleanup listener on unmount
        };

        loadAndListen();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [schoolId]);

    // Group by teacher name (unchanged)
    const groupedAssignments = useMemo(() => {
        const grouped = {};
        assignments.forEach((assign) => {
            const teacherName = assign.teacher || "Unknown Teacher";
            if (!grouped[teacherName]) {
                grouped[teacherName] = [];
            }
            grouped[teacherName].push({
                className: assign.className,
                subjects: assign.subjects || [],
            });
        });
        return grouped;
    }, [assignments]);

    // Filter by teacher name or class name (unchanged)
    const filteredTeachers = useMemo(() => {
        return Object.entries(groupedAssignments).filter(([teacher, classes]) => {
            const lowerSearch = searchTerm.toLowerCase();
            return (
                teacher.toLowerCase().includes(lowerSearch) ||
                classes.some((cls) => cls.className.toLowerCase().includes(lowerSearch))
            );
        });
    }, [groupedAssignments, searchTerm]);

    // 🖨️ Handle print - open a clean version (unchanged)
    const handlePrint = () => {
        const printWindow = window.open("", "_blank");
        
        // Sort the filtered data for printing
        const sortedFilteredTeachers = filteredTeachers.map(([teacher, classList]) => {
            return [teacher, sortClassesAlphabetically(classList)];
        });

        const htmlContent = `
        <html>
            <head>
                <title>Teacher Assignment Report - ${schoolId}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 30px; color: #333; }
                    h1, h2, h3 { text-align: center; }
                    .school-header { text-align: center; margin-bottom: 20px; }
                    .teacher-section { margin-bottom: 25px; } 
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    th, td { border: 1px solid #ccc; padding: 8px; font-size: 14px; }
                    th { background: #e2e8f0; text-align: left; }
                    .teacher-title { color: #1e3a8a; font-size: 18px; margin-bottom: 5px; }
                    @media print {
                        body { margin: 0; }
                        .teacher-section:last-child { margin-bottom: 0; }
                        * {
                          -webkit-print-color-adjust: exact !important;
                          color-adjust: exact !important;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="school-header">
                    <h1>Teacher Assignment Report</h1>
                </div>

                ${sortedFilteredTeachers.map(([teacher, classList]) => `
                    <div class="teacher-section">
                        <h3 class="teacher-title">Teacher: ${teacher}</h3>
                        <table>
                            <thead>
                                <tr>
                                    <th>Class</th>
                                    <th>Subjects</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${classList
                                    .map(
                                        (cls) => `
                                    <tr>
                                        <td>${cls.className}</td>
                                        <td>${cls.subjects.join(", ")}</td>
                                    </tr>`
                                    )
                                    .join("")}
                            </tbody>
                        </table>
                    </div>
                `).join("")}

                <script>
                    window.onload = () => window.print();
                </script>
            </body>
        </html>
        `;
        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    if (loading && assignments.length === 0) {
        return (
            <div className="p-6 text-center">
                <p className="text-xl font-medium text-gray-700">Loading teacher assignments...</p>
                <p className="text-sm text-gray-500 mt-2">Checking IndexDB cache or fetching live data.</p>
            </div>
        );
    }


    return (
        <div className="max-w-5xl mx-auto p-6 bg-white rounded-2xl shadow-md">
            <h2 className="text-2xl font-bold text-center text-gray-800 mb-4">
                Teacher Assignment Report 🧑‍🏫
            </h2>

            <div className="text-center text-sm text-gray-500 mb-4">
                School ID: <span className="font-semibold">{schoolId}</span>
            </div>

            {/* Filter and Print Button */}
            <div className="mb-4 flex justify-between items-center">
                <input
                    type="text"
                    placeholder="Filter by Teacher or Class..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-3/4 border rounded-md px-4 py-2 focus:ring focus:ring-indigo-300"
                />
                <button
                    onClick={handlePrint}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                    Print
                </button>
            </div>

            {/* Report Table Display */}
            {filteredTeachers.length === 0 ? (
                <p className="text-center text-gray-500 py-6">
                    No assignments found matching your filter criteria.
                </p>
            ) : (
                filteredTeachers.map(([teacher, classList], index) => (
                    <div key={index} className="mb-6 border rounded-lg p-4 bg-gray-50">
                        <h3 className="text-lg font-bold text-blue-700 mb-3">
                            Teacher: {teacher}
                        </h3>

                        <table className="w-full text-sm border border-gray-300 rounded-md">
                            <thead className="bg-gray-200 text-gray-700">
                                <tr>
                                    <th className="border px-3 py-2 text-left w-1/3">Class</th>
                                    <th className="border px-3 py-2 text-left">Subjects</th>
                                </tr>
                            </thead>
                            <tbody>
                                {/* Sorting applied here for the main display */}
                                {sortClassesAlphabetically(classList).map((cls, i) => (
                                    <tr key={i} className="hover:bg-white">
                                        <td className="border px-3 py-2 font-medium">{cls.className}</td>
                                        <td className="border px-3 py-2">{cls.subjects.join(", ")}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ))
            )}
        </div>
    );
};

export default TeacherAssignmentReport;