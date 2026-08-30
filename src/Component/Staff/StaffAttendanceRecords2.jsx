import React, { useEffect, useState, useRef } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { db } from "../../../firebase"; // Ensure path matches your setup
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { toast } from "react-toastify";
import { useLocation } from "react-router-dom";

const AttendanceScanner = () => {
  const location = useLocation();
  const currentSchoolId = location.state?.schoolId || null;

  // View State: 'scanner' or 'manual'
  const [activeTab, setActiveTab] = useState("scanner");

  // QR Scanning States
  const [scanMode, setScanMode] = useState("clockIn");
  const [scanResult, setScanResult] = useState(null);
  const [processing, setProcessing] = useState(false);

  // Teachers List State for Dropdown
  const [teachersList, setTeachersList] = useState([]);
  const [loadingTeachers, setLoadingTeachers] = useState(false);

  // Manual Status Override States
  const [manualTeacherID, setManualTeacherID] = useState("");
  const [selectedTeacherName, setSelectedTeacherName] = useState("");
  const [manualStatus, setManualStatus] = useState("Excuse");
  const [manualNote, setManualNote] = useState("");
  const [manualSubmitting, setManualSubmitting] = useState(false);

  const scanModeRef = useRef(scanMode);
  useEffect(() => {
    scanModeRef.current = scanMode;
  }, [scanMode]);

  // Fetch teachers list for dropdown
  useEffect(() => {
    const fetchTeachers = async () => {
      setLoadingTeachers(true);
      try {
        let q;
        if (currentSchoolId) {
          q = query(collection(db, "Teachers"), where("schoolId", "==", currentSchoolId));
        } else {
          q = collection(db, "Teachers");
        }
        const snap = await getDocs(q);
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        list.sort((a, b) => (a.teacherName || "").localeCompare(b.teacherName || ""));
        setTeachersList(list);
      } catch (err) {
        console.error("Error fetching teachers list:", err);
        toast.error("Failed to load staff list.");
      } finally {
        setLoadingTeachers(false);
      }
    };

    fetchTeachers();
  }, [currentSchoolId]);

  // QR Code Scanner Effect
  useEffect(() => {
    let scanner = null;

    if (activeTab === "scanner") {
      scanner = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
      );

      scanner.render(onScanSuccess, () => {});
    }

    async function onScanSuccess(decodedText) {
      if (processing) return;

      try {
        let parsedData;
        try {
          parsedData = JSON.parse(decodedText);
        } catch {
          parsedData = { teacherID: decodedText };
        }

        if (!parsedData.teacherID) {
          toast.error("Invalid QR Code format.");
          return;
        }

        setProcessing(true);
        if (scanner) scanner.pause(true);

        await handleAttendanceLogging(parsedData.teacherID, scanModeRef.current);

        setTimeout(() => {
          setProcessing(false);
          if (scanner) scanner.resume();
        }, 3000);
      } catch (err) {
        console.error("Scanning error:", err);
        toast.error("Failed to process QR Code.");
        setProcessing(false);
        if (scanner) scanner.resume();
      }
    }

    return () => {
      if (scanner) {
        scanner.clear().catch((err) => console.error("Scanner clear failed", err));
      }
    };
  }, [activeTab]);

  const calculateClockInStatus = (nowDate) => {
    const hours = nowDate.getHours();
    const minutes = nowDate.getMinutes();
    const totalMinutes = hours * 60 + minutes;

    const eightAMInMinutes = 8 * 60;
    const twelvePMInMinutes = 12 * 60;

    if (totalMinutes < eightAMInMinutes) {
      return { status: "Present", allowed: true };
    } else if (totalMinutes >= eightAMInMinutes && totalMinutes < twelvePMInMinutes) {
      return { status: "Late", allowed: true };
    } else {
      return { status: "Absent", allowed: false };
    }
  };

  // QR Scanner Handler with strict warnings
  const handleAttendanceLogging = async (teacherID, mode) => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const nowTime = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const teacherQ = query(collection(db, "Teachers"), where("teacherID", "==", teacherID));
    const teacherSnap = await getDocs(teacherQ);

    if (teacherSnap.empty) {
      toast.error(`Teacher ID ${teacherID} not found.`);
      return;
    }

    const teacherData = teacherSnap.docs[0].data();
    const activeSchoolId = currentSchoolId || teacherData.schoolId || "N/A";

    const attQ = query(
      collection(db, "StaffAttendance2"),
      where("teacherID", "==", teacherID),
      where("date", "==", todayStr)
    );
    const attSnap = await getDocs(attQ);

    // CLOCK IN
    if (mode === "clockIn") {
      if (!attSnap.empty) {
        const existingLog = attSnap.docs[0].data();
        toast.warning(`⚠️ ${teacherData.teacherName} already logged today (${existingLog.status}). Cannot scan again.`);
        setScanResult({
          name: teacherData.teacherName,
          action: `Clock In Blocked (Already logged as ${existingLog.status})`,
          time: existingLog.clockIn || "--",
          clockOutTime: existingLog.clockOut || "--",
          status: existingLog.status,
          teacherID: teacherData.teacherID,
          isError: true,
        });
        return;
      }

      const { status: derivedStatus, allowed } = calculateClockInStatus(now);

      if (!allowed) {
        await addDoc(collection(db, "StaffAttendance2"), {
          teacherID: teacherData.teacherID,
          teacherName: teacherData.teacherName,
          schoolId: activeSchoolId,
          date: todayStr,
          clockIn: null,
          clockOut: null,
          status: "Absent",
          note: "Attempted clock-in past 12:00 PM cutoff",
          isManual: false,
          timestamp: serverTimestamp(),
        });

        toast.error(`❌ Blocked: Marked as ABSENT (Past 12:00 PM)`);
        return;
      }

      await addDoc(collection(db, "StaffAttendance2"), {
        teacherID: teacherData.teacherID,
        teacherName: teacherData.teacherName,
        schoolId: activeSchoolId,
        date: todayStr,
        clockIn: nowTime,
        clockOut: null,
        status: derivedStatus,
        isManual: false,
        timestamp: serverTimestamp(),
      });

      toast.success(`✅ Clocked IN: ${teacherData.teacherName} at ${nowTime}`);
    }

    // CLOCK OUT
    else if (mode === "clockOut") {
      if (attSnap.empty) {
        toast.error(`⚠️ ${teacherData.teacherName} has not clocked in today.`);
        return;
      }

      const existingLogDoc = attSnap.docs[0];
      const existingLogData = existingLogDoc.data();

      if (existingLogData.clockOut) {
        toast.warning(`⚠️ ${teacherData.teacherName} has already clocked out today.`);
        return;
      }

      const attRef = doc(db, "StaffAttendance2", existingLogDoc.id);
      await updateDoc(attRef, {
        clockOut: nowTime,
        updatedAt: serverTimestamp(),
      });

      toast.info(`🚪 Clocked OUT: ${teacherData.teacherName} at ${nowTime}`);
    }
  };

  const handleTeacherSelect = (e) => {
    const selectedId = e.target.value;
    setManualTeacherID(selectedId);
    const foundTeacher = teachersList.find((t) => t.teacherID === selectedId);
    setSelectedTeacherName(foundTeacher ? foundTeacher.teacherName : "");
  };

  // Submit Manual Entry with mandatory note & override prompt warning
  const handleManualStatusSubmit = async (e) => {
    e.preventDefault();

    if (!manualTeacherID.trim()) {
      toast.error("Please select a teacher from the list.");
      return;
    }

    // Mandatory note validation
    if (!manualNote.trim()) {
      toast.error("⚠️ Short note is compulsory for every manual entry!");
      return;
    }

    setManualSubmitting(true);

    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const teacherQ = query(collection(db, "Teachers"), where("teacherID", "==", manualTeacherID.trim()));
      const teacherSnap = await getDocs(teacherQ);

      if (teacherSnap.empty) {
        toast.error(`Teacher ID ${manualTeacherID} not found.`);
        setManualSubmitting(false);
        return;
      }

      const teacherData = teacherSnap.docs[0].data();
      const activeSchoolId = currentSchoolId || teacherData.schoolId || "N/A";

      // Check for existing records today
      const attQ = query(
        collection(db, "StaffAttendance2"),
        where("teacherID", "==", manualTeacherID.trim()),
        where("date", "==", todayStr)
      );
      const attSnap = await getDocs(attQ);

      let recordDocId = null;

      if (!attSnap.empty) {
        const existing = attSnap.docs[0].data();
        recordDocId = attSnap.docs[0].id;

        // Warning prompt before overriding existing record
        const confirmOverride = window.confirm(
          `⚠️ WARNING: ${teacherData.teacherName} has already been logged today (Status: ${existing.status}).\n\nAre you sure you want to override this record with "${manualStatus}"?`
        );

        if (!confirmOverride) {
          setManualSubmitting(false);
          return;
        }
      }

      const payload = {
        teacherID: teacherData.teacherID,
        teacherName: teacherData.teacherName,
        schoolId: activeSchoolId,
        date: todayStr,
        clockIn: null,
        clockOut: null,
        status: manualStatus,
        note: manualNote.trim(),
        isManual: true,
        loggedBy: "Admin Manual Override",
        timestamp: serverTimestamp(),
      };

      if (recordDocId) {
        // Update existing document instead of duplicating
        await updateDoc(doc(db, "StaffAttendance2", recordDocId), payload);
        toast.success(`✅ Overrode record for ${teacherData.teacherName} as ${manualStatus.toUpperCase()}`);
      } else {
        // Add new document
        await addDoc(collection(db, "StaffAttendance2"), payload);
        toast.success(`✅ Recorded: ${teacherData.teacherName} as ${manualStatus.toUpperCase()}`);
      }

      // Reset form
      setManualTeacherID("");
      setSelectedTeacherName("");
      setManualNote("");
    } catch (error) {
      console.error("Error submitting manual status:", error);
      toast.error("Failed to log manual status.");
    } finally {
      setManualSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6 flex flex-col items-center">
      <div className="bg-white p-6 rounded-2xl shadow-lg w-full max-w-md">
        {/* Header Switcher Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            onClick={() => setActiveTab("scanner")}
            className={`flex-1 py-3 text-sm font-bold text-center border-b-2 transition ${
              activeTab === "scanner"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            📷 QR Scanner
          </button>
          <button
            onClick={() => setActiveTab("manual")}
            className={`flex-1 py-3 text-sm font-bold text-center border-b-2 transition ${
              activeTab === "manual"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            📝 Manual Override
          </button>
        </div>

        {/* TAB 1: QR SCANNER VIEW */}
        {activeTab === "scanner" && (
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-4">Select mode and scan teacher QR code</p>
            <div className="flex justify-center space-x-3 mb-6 bg-gray-100 p-2 rounded-xl border border-gray-200">
              <label
                className={`flex-1 flex items-center justify-center py-2 px-3 rounded-lg font-bold text-sm cursor-pointer transition ${
                  scanMode === "clockIn" ? "bg-green-600 text-white shadow-md" : "text-gray-600 hover:bg-gray-200"
                }`}
              >
                <input
                  type="radio"
                  name="scanMode"
                  value="clockIn"
                  checked={scanMode === "clockIn"}
                  onChange={() => setScanMode("clockIn")}
                  className="hidden"
                />
                <span>📥 Clock IN</span>
              </label>
              <label
                className={`flex-1 flex items-center justify-center py-2 px-3 rounded-lg font-bold text-sm cursor-pointer transition ${
                  scanMode === "clockOut" ? "bg-blue-600 text-white shadow-md" : "text-gray-600 hover:bg-gray-200"
                }`}
              >
                <input
                  type="radio"
                  name="scanMode"
                  value="clockOut"
                  checked={scanMode === "clockOut"}
                  onChange={() => setScanMode("clockOut")}
                  className="hidden"
                />
                <span>📤 Clock OUT</span>
              </label>
            </div>
            <div id="reader" className="w-full overflow-hidden rounded-xl border border-gray-200"></div>
          </div>
        )}

        {/* TAB 2: MANUAL OVERRIDE FORM */}
        {activeTab === "manual" && (
          <form onSubmit={handleManualStatusSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Select Staff Member *</label>
              <select
                value={manualTeacherID}
                onChange={handleTeacherSelect}
                className="w-full p-2.5 border rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-indigo-500 outline-none"
                disabled={loadingTeachers}
              >
                <option value="">-- Choose Staff --</option>
                {teachersList.map((t) => (
                  <option key={t.id} value={t.teacherID}>
                    {t.teacherName} ({t.teacherID})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Status *</label>
              <select
                value={manualStatus}
                onChange={(e) => setManualStatus(e.target.value)}
                className="w-full p-2.5 border rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="Excuse">Excuse</option>
                <option value="Leave">Leave</option>
                <option value="Absent">Absent</option>
                <option value="Present">Present (Manual)</option>
                <option value="Late">Late (Manual)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Reason / Note <span className="text-red-500">* Required</span>
              </label>
              <textarea
                value={manualNote}
                onChange={(e) => setManualNote(e.target.value)}
                placeholder="State reason for manual entry or override..."
                className="w-full p-2.5 border rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-indigo-500 outline-none h-20"
                required
              />
            </div>

            <button
              type="submit"
              disabled={manualSubmitting}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition shadow-md disabled:opacity-50 text-sm"
            >
              {manualSubmitting ? "Saving..." : "Submit Entry"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default AttendanceScanner;