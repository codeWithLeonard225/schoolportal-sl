import React, { useState, useEffect, useCallback } from "react";
import { db } from "../../../firebase";
import { schooldb } from "../Database/SchoolsResults"; 
import {
    collection,
    onSnapshot,
    query,
    where,
    setDoc,
    doc,
    serverTimestamp,
    orderBy,
    limit,
    getDocs,
    deleteDoc, // NEW: For deleting grades
} from "firebase/firestore";
// ❌ REMOVED: import { useAuth } from "../Security/AuthContext"; 
import { useLocation } from "react-router-dom";
import jsPDF from "jspdf"; 
import autoTable from "jspdf-autotable"; 

// Component renamed to reflect its new admin/audit purpose
const GradesAuditPage = () => {
    // ❌ REMOVED: const { user } = useAuth();

    const location = useLocation();
    const schoolId = location.state?.schoolId || "N/A";

    // ⭐️ NEW STATE for Teacher Selection and all assignments discovery
    const [allTeachers, setAllTeachers] = useState([]);
    const [selectedTeacherName, setSelectedTeacherName] = useState(""); 
    
    // Grades will now store all fetched grades, keyed by pupilID, including the docId
    const [currentGrades, setCurrentGrades] = useState({}); // { pupilID: { grade: 85, teacher: "Name", docId: "xyz" } }
    // State to track changes made by the Admin
    const [updatedGrades, setUpdatedGrades] = useState({}); // { pupilID: newGradeValue (or null for delete) }
    
    // Existing states
    const [assignments, setAssignments] = useState([]);
    const [pupils, setPupils] = useState([]);
    const [selectedClass, setSelectedClass] = useState("");
    const [selectedSubject, setSelectedSubject] = useState("");
    const [selectedTest, setSelectedTest] = useState("Term 1 T1");
    const [academicYear, setAcademicYear] = useState("");
    const [submitting, setSubmitting] = useState(false);
    
    
    const tests = ["Term 1 T1", "Term 1 T2", "Term 2 T1", "Term 2 T2","Term 3 T1", "Term 3 T2"];

    // 1️⃣ Fetch All Teachers & Assignments to discover available classes/subjects
    useEffect(() => {
        if (!schoolId) return;

        const qAssignments = query(
            collection(db, "TeacherAssignments"),
            where("schoolId", "==", schoolId)
        );

        const unsub = onSnapshot(qAssignments, (snapshot) => {
            const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            
            // Get unique teacher names for the selector
            const uniqueTeachers = [...new Set(data.map(a => a.teacher))].sort();
            setAllTeachers(uniqueTeachers);

            // Get unique classes and their subjects to populate the tabs
            const uniqueAssignments = data.reduce((acc, assignment) => {
                const existing = acc.find(a => a.className === assignment.className);
                if (existing) {
                    assignment.subjects.forEach(subject => {
                        if (!existing.subjects.includes(subject)) {
                            existing.subjects.push(subject);
                        }
                    });
                } else {
                    acc.push({ ...assignment, subjects: [...assignment.subjects] });
                }
                return acc;
            }, []).sort((a, b) => a.className.localeCompare(b.className));

            setAssignments(uniqueAssignments);

            // Set initial class/subject if not set
            if (uniqueAssignments.length > 0) {
                if (!selectedClass || !uniqueAssignments.some(a => a.className === selectedClass)) {
                    setSelectedClass(uniqueAssignments[0].className);
                    setSelectedSubject(uniqueAssignments[0].subjects[0]);
                }
            }
        });
        
        return () => unsub();
    }, [schoolId, selectedClass]); 

    // 2️⃣ Fetch latest academic year (unchanged)
    useEffect(() => {
        const q = query(collection(db, "PupilsReg"), orderBy("academicYear", "desc"), limit(1));
        const unsub = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                setAcademicYear(snapshot.docs[0].data().academicYear);
            }
        });
        return () => unsub();
    }, []);

    // 3️⃣ Fetch pupils for selected class (unchanged)
    useEffect(() => {
        if (!selectedClass || !academicYear || !schoolId) {
            setPupils([]);
            return;
        }

        const pupilsQuery = query(
            collection(db, "PupilsReg"),
            where("class", "==", selectedClass),
            where("academicYear", "==", academicYear),
            where("schoolId", "==", schoolId)
        );

        const unsub = onSnapshot(pupilsQuery, (snapshot) => {
            const data = snapshot.docs
                .map((doc) => ({ id: doc.id, studentID: doc.id, ...doc.data() }))
                .sort((a, b) => a.studentName?.localeCompare(b.studentName));

            setPupils(data);
            setUpdatedGrades({}); // Reset updates when pupils change
        });

        return () => unsub();
    }, [selectedClass, academicYear, schoolId]);

    // 4️⃣ Fetch ALL existing grades for the selected filter
    const fetchGrades = useCallback(async () => {
        if (!selectedClass || !selectedSubject || !selectedTest || !academicYear || !schoolId) {
            setCurrentGrades({});
            setUpdatedGrades({});
            return;
        }

        // Query now filters by selectedTeacherName if one is chosen
        let gradeQuery = query(
            collection(schooldb, "PupilGrades"), // Use schooldb as per your original
            where("className", "==", selectedClass),
            where("subject", "==", selectedSubject),
            where("test", "==", selectedTest),
            where("academicYear", "==", academicYear),
            where("schoolId", "==", schoolId),
        );
        
        // Conditional filtering by teacher
        if (selectedTeacherName) {
            gradeQuery = query(gradeQuery, where("teacher", "==", selectedTeacherName));
        }

        const snapshot = await getDocs(gradeQuery);
        const gradesMap = {};
        
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            gradesMap[data.pupilID] = { 
                grade: data.grade, 
                teacher: data.teacher,
                docId: doc.id // Store Firestore document ID for update/delete
            };
        });
        
        setCurrentGrades(gradesMap);
        setUpdatedGrades({}); // Reset updates when new grades are fetched
    }, [selectedClass, selectedSubject, selectedTest, academicYear, schoolId, selectedTeacherName]);

    useEffect(() => {
        fetchGrades();
    }, [fetchGrades]);


    // Helper to handle grade input change
    const handleGradeChange = (pupilID, value) => {
        const numValue = parseFloat(value);
        // Only allow non-negative numbers or empty string
        if (value !== "" && (isNaN(numValue) || numValue < 0)) return;
        
        // Store null if empty to signify deletion/no grade on action button
        setUpdatedGrades(prev => ({ 
            ...prev, 
            [pupilID]: value === "" ? null : numValue 
        }));
    };
    
    // Helper to get the grade to display (Updated > Current)
    const getDisplayGrade = (pupilID) => {
        // If a value exists in updatedGrades, use it.
        if (updatedGrades.hasOwnProperty(pupilID)) {
            // Null in updatedGrades means the user cleared the field to delete the grade
            return updatedGrades[pupilID] === null ? "" : updatedGrades[pupilID];
        }
        return currentGrades[pupilID]?.grade || "";
    };

    // 5️⃣ The primary action function: Update, Delete, or Add New Grade
    const handleAdminAction = async (pupilID) => {
        setSubmitting(true);
        const gradeData = currentGrades[pupilID];
        const newGradeValue = updatedGrades[pupilID];
        
        try {
            // 1. Delete Action: Grade exists AND the new value is explicitly null (cleared field)
            if (gradeData && newGradeValue === null) {
                if (!window.confirm(`Are you sure you want to DELETE the grade for ${pupilID}?`)) {
                     setSubmitting(false);
                     return;
                }
                await deleteDoc(doc(schooldb, "PupilGrades", gradeData.docId));
                alert(`🗑️ Grade for Pupil ID ${pupilID} deleted successfully.`);
            } 
            // 2. Update/Add Action: New value is a valid number
            else if (typeof newGradeValue === 'number' && !isNaN(newGradeValue)) {
                
                // If the grade already exists, update the existing document
                if (gradeData) {
                    if (!window.confirm(`Are you sure you want to UPDATE the grade for ${pupilID} from ${gradeData.grade} to ${newGradeValue}?`)) {
                         setSubmitting(false);
                         return;
                    }
                    await setDoc(doc(schooldb, "PupilGrades", gradeData.docId), {
                        grade: newGradeValue,
                        lastModifiedByAdmin: serverTimestamp(),
                    }, { merge: true }); // Merge to preserve existing fields like 'teacher'
                    alert(`✏️ Grade for Pupil ID ${pupilID} updated successfully.`);
                } 
                // If it's a new grade being manually added by Admin (no existing doc)
                else {
                    if (!window.confirm(`Are you sure you want to ADD a new grade of ${newGradeValue} for ${pupilID}?`)) {
                         setSubmitting(false);
                         return;
                    }
                    const docRef = doc(collection(schooldb, "PupilGrades"));
                    await setDoc(docRef, {
                        pupilID,
                        className: selectedClass,
                        subject: selectedSubject,
                        teacher: "Admin Override", // Log Admin as the initial submitter
                        grade: newGradeValue,
                        test: selectedTest,
                        academicYear,
                        schoolId,
                        timestamp: serverTimestamp(),
                        lastModifiedByAdmin: serverTimestamp(), // Track the admin action
                    });
                    alert(`➕ New grade for Pupil ID ${pupilID} submitted successfully.`);
                }
            } else {
                alert("No valid change or action detected.");
                setSubmitting(false); 
                return;
            }
            
            // Re-fetch data to update the UI and state after successful action
            await fetchGrades();
            
        } catch (err) {
            console.error("Error performing admin action:", err);
            alert("❌ Error performing action on grade.");
        } finally {
            setSubmitting(false);
            // Remove the grade from updatedGrades as the action is complete
            setUpdatedGrades(prev => {
                const newState = { ...prev };
                delete newState[pupilID];
                return newState;
            });
        }
    };
    
    // 6️⃣ Download PDF (Adjusted for Admin Audit View)
    const handleDownloadPDF = () => {
        if (pupils.length === 0) {
            alert("No data available to generate PDF.");
            return;
        }

        const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "A4" });
        let startY = 30;

        // Title
        doc.setFontSize(16).setFont(doc.getFont().fontName, "bold");
        doc.text(`Grades Audit Record (Admin View)`, 40, startY);
        startY += 20;

        // Details
        doc.setFontSize(11).setFont(doc.getFont().fontName, "normal");
        doc.text(`Class: ${selectedClass}`, 40, startY);
        doc.text(`Subject: ${selectedSubject}`, 200, startY);
        doc.text(`Test: ${selectedTest}`, 350, startY);
        startY += 15;
        doc.text(`Academic Year: ${academicYear}`, 40, startY);
        doc.text(`Teacher Filter: ${selectedTeacherName || 'ALL'}`, 200, startY);
        startY += 25;

        // Table Data
        const tableData = pupils.map((pupil, index) => {
            const gradeInfo = currentGrades[pupil.studentID];
            const grade = gradeInfo?.grade || "N/A";
            const teacher = gradeInfo?.teacher || "N/A";
            
            // Only include pupils for whom a grade exists in the current view
            if (grade === "N/A" && !updatedGrades.hasOwnProperty(pupil.studentID)) return null; 

            // If an update is pending, show the updated value in the PDF
            const displayGrade = updatedGrades.hasOwnProperty(pupil.studentID) 
                                 ? (updatedGrades[pupil.studentID] === null ? "DELETED" : updatedGrades[pupil.studentID])
                                 : grade;

            return [
                index + 1,
                pupil.studentName,
                pupil.studentID,
                displayGrade,
                teacher
            ];
        }).filter(row => row !== null);

        // Table Headers
        const head = [['#', 'Student Name', 'Student ID', 'Grade', 'Submitted By']];

        // AutoTable
        autoTable(doc, {
            startY: startY,
            head: head,
            body: tableData,
            theme: "striped",
            styles: { fontSize: 10, cellPadding: 5 },
            columnStyles: {
                0: { cellWidth: 30, halign: 'center' },
                1: { cellWidth: 150, halign: 'left' },
                2: { cellWidth: 70, halign: 'center' },
                3: { cellWidth: 60, halign: 'center', fontStyle: 'bold' },
                4: { cellWidth: 100, halign: 'left' },
            }
        });

        // Save PDF
        doc.save(`Admin_Audit_${selectedClass}_${selectedSubject}_${selectedTest}_Grades.pdf`);
    };

    return (
        <div className="max-w-7xl mx-auto p-6 bg-white rounded-2xl shadow-xl relative">
            <h2 className="text-3xl font-bold mb-4 text-center text-blue-700">
                ⭐ Admin Grade Audit & Management
            </h2>

            <p className="mb-6 text-gray-700 font-medium border-b pb-3">
                School ID: <span className="font-bold">{schoolId}</span> | Academic Year: <span className="font-bold">{academicYear}</span>
            </p>

            {/* Selector Row */}
            <div className="flex gap-4 mb-6 items-end border p-3 rounded-lg bg-gray-50">
                {/* Teacher Selector */}
                <div className="flex-1 min-w-[200px]">
                    <label className="font-semibold text-gray-700 block mb-1">Filter by Teacher:</label>
                    <select
                        value={selectedTeacherName}
                        onChange={(e) => setSelectedTeacherName(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-400 bg-white shadow-sm"
                    >
                        <option value="">-- ALL TEACHERS --</option>
                        {allTeachers.map((name, i) => (
                            <option key={i} value={name}>
                                {name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Test Selector */}
                <div className="flex-1 min-w-[200px]">
                    <label className="font-semibold text-gray-700 block mb-1">Select Test:</label>
                    <select
                        value={selectedTest}
                        onChange={(e) => setSelectedTest(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-green-400 bg-white shadow-sm"
                    >
                        {tests.map((test, i) => (
                            <option key={i} value={test}>
                                {test}
                            </option>
                        ))}
                    </select>
                </div>
                
                <div className="flex-1">
                    <button
                        onClick={handleDownloadPDF}
                        className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-all shadow-md"
                    >
                        ⬇️ Download Current View PDF
                    </button>
                </div>
            </div>

            {/* Class & Subject Tabs */}
            <div className="mb-6 border-t pt-4">
                <p className="font-semibold text-gray-700 mb-2">Filter by Class:</p>
                {assignments.length > 0 && (
                    <div className="flex gap-2 flex-wrap mb-4">
                        {assignments.map((a) => (
                            <button
                                key={a.className}
                                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors shadow-sm ${
                                    selectedClass === a.className ? "bg-blue-600 text-white shadow-blue-300" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                }`}
                                onClick={() => {
                                    setSelectedClass(a.className);
                                    setSelectedSubject(a.subjects[0]);
                                }}
                            >
                                {a.className}
                            </button>
                        ))}
                    </div>
                )}
                
                {assignments.length > 0 && selectedClass && (
                    <>
                        <p className="font-semibold text-gray-700 mb-2 mt-4">Filter by Subject ({selectedClass}):</p>
                        <div className="flex gap-2 flex-wrap">
                            {assignments
                                .find((a) => a.className === selectedClass)
                                ?.subjects.map((subject, i) => (
                                    <button
                                        key={i}
                                        className={`px-4 py-2 rounded-full text-sm font-medium transition-colors shadow-sm ${
                                            selectedSubject === subject ? "bg-green-600 text-white shadow-green-300" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                        }`}
                                        onClick={() => setSelectedSubject(subject)}
                                    >
                                        {subject}
                                    </button>
                                ))}
                        </div>
                    </>
                )}
            </div>
            
            <h3 className="text-xl font-bold mt-8 mb-4 border-b pb-2 text-gray-800">
                Grades for: {selectedClass} - {selectedSubject} ({selectedTest})
            </h3>
            
            {/* Pupils Table */}
            <div className="overflow-x-auto shadow-lg rounded-xl">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-blue-50 text-blue-800 sticky top-0">
                        <tr>
                            <th className="px-4 py-3 text-left font-bold">#</th>
                            <th className="px-4 py-3 text-left font-bold">Student Name</th>
                            <th className="px-4 py-3 text-left font-bold">Student ID</th>
                            <th className="px-4 py-3 text-center font-bold">Grade</th>
                            <th className="px-4 py-3 text-left font-bold">Submitted By</th>
                            <th className="px-4 py-3 text-center font-bold">Admin Action</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                        {pupils.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="text-center py-8 text-gray-500 bg-gray-50">
                                    No pupils found for the selected class.
                                </td>
                            </tr>
                        ) : (
                            pupils.map((pupil, index) => {
                                const gradeInfo = currentGrades[pupil.studentID];
                                const displayGrade = getDisplayGrade(pupil.studentID);
                                const isModified = updatedGrades.hasOwnProperty(pupil.studentID);
                                const isNewGrade = !gradeInfo && displayGrade !== "";
                                const newGradeValue = updatedGrades[pupil.studentID];
                                
                                // Disable action on the current row if any other row is submitting
                                const actionDisabled = submitting; 

                                return (
                                    <tr key={pupil.id} className="hover:bg-yellow-50 transition-colors">
                                        <td className="px-4 py-3 text-center">{index + 1}</td>
                                        <td className="px-4 py-3 font-medium">{pupil.studentName}</td>
                                        <td className="px-4 py-3 text-gray-600">{pupil.studentID}</td>
                                        <td className="px-4 py-3 text-center">
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                value={displayGrade} 
                                                onChange={(e) => handleGradeChange(pupil.studentID, e.target.value)}
                                                className={`w-20 border px-2 py-1 rounded-md text-center focus:ring-2 focus:ring-red-400 transition-shadow ${
                                                    isModified ? "bg-red-100 border-red-500" : "border-gray-300"
                                                }`}
                                                disabled={actionDisabled}
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">
                                            {gradeInfo?.teacher || (isNewGrade ? "Admin Override (New)" : "N/A")}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {/* Action Button: Visible only if modified or new grade */}
                                            {isModified || isNewGrade ? (
                                                <button
                                                    onClick={() => handleAdminAction(pupil.studentID)}
                                                    className={`px-3 py-1 text-xs rounded transition-colors font-semibold ${
                                                        actionDisabled
                                                            ? "bg-gray-400 cursor-wait"
                                                            : (newGradeValue === null && gradeInfo)
                                                            ? "bg-red-600 hover:bg-red-700 text-white" // Deletion
                                                            : "bg-orange-500 hover:bg-orange-600 text-white" // Update/New
                                                    }`}
                                                    disabled={actionDisabled}
                                                    title={
                                                        (newGradeValue === null && gradeInfo)
                                                        ? "Delete Grade"
                                                        : gradeInfo
                                                        ? "Update Grade"
                                                        : "Add New Grade"
                                                    }
                                                >
                                                    {actionDisabled
                                                        ? "Saving..."
                                                        : (newGradeValue === null && gradeInfo)
                                                        ? "DELETE"
                                                        : "SAVE"}
                                                </button>
                                            ) : (
                                                <span className="text-gray-400 text-xs">No pending action</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
            
            <div className="mt-8 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                <p className="font-bold">⚠️ Admin Override Note:</p>
                <ul className="list-disc list-inside mt-1">
                    <li>The **Grade** column allows live editing.</li>
                    <li>If you change the grade, the **Admin Action** button will appear with a **SAVE** option to update or add the grade.</li>
                    <li>Clearing the grade field and clicking **DELETE** will permanently remove the grade record.</li>
                    <li>**Teacher Filter** allows you to audit grades submitted by a specific teacher for the selected Class/Subject/Test. Selecting **-- ALL TEACHERS --** shows every grade recorded.</li>
                </ul>
            </div>
        </div>
    );
};

export default GradesAuditPage;