import React, { useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { schoollpq } from "../Database/schoollibAndPastquestion";
import { useAuth } from "../Security/AuthContext";

const TimeTableDailyAttendanceReport = () => {
  const { user } = useAuth();
  const schoolId = user?.schoolId;

  const [selectedDate, setSelectedDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState({
    Present: [],
    Late: [],
    Absent: []
  });

  const fetchDailyReport = async () => {
    if (!selectedDate) return;

    setLoading(true);

    const q = query(
      collection(schoollpq, "TeacherAttendance"),
      where("schoolId", "==", schoolId),
      where("date", "==", selectedDate)
    );

    const snapshot = await getDocs(q);

    const data = { Present: [], Late: [], Absent: [] };

    snapshot.forEach(doc => {
      const row = doc.data();
      data[row.status].push(row);
    });

    setReport(data);
    setLoading(false);
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto bg-white p-6 rounded-2xl shadow">

        <h1 className="text-xl font-black mb-4 uppercase">
          Daily Teacher Attendance Report
        </h1>

        <div className="flex gap-3 mb-6">
          <input
            type="date"
            className="border p-2 rounded-lg font-bold text-sm"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
          />

          <button
            onClick={fetchDailyReport}
            className="bg-teal-600 text-white px-4 rounded-lg font-black text-sm"
          >
            Load Report
          </button>
        </div>

        {loading ? (
          <p className="font-bold text-gray-400">Loading...</p>
        ) : (
          ["Present", "Late", "Absent"].map(status => (
            <div key={status} className="mb-6">
              <h2 className="font-black text-sm uppercase mb-2">
                {status} ({report[status].length})
              </h2>

              {report[status].length === 0 ? (
                <p className="text-xs text-gray-400">No records</p>
              ) : (
                <div className="space-y-2">
                  {report[status].map((item, i) => (
                    <div
                      key={i}
                      className="p-3 border rounded-xl flex justify-between"
                    >
                      <div>
                        <p className="font-black text-sm">{item.teacherName}</p>
                        <p className="text-xs text-gray-500">
                          {item.subject} • {item.className}
                        </p>
                      </div>
                      <span className="text-xs font-black">
                        Period {item.period}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}

      </div>
    </div>
  );
};

export default TimeTableDailyAttendanceReport;
