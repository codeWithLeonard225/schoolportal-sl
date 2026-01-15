import React, { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "../../../firebase";
import { pupilLoginFetch } from "../Database/PupilLogin";
import { toast } from "react-toastify";

const PupilsWithoutSchool = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  /* ----------------------------------------------------
     FETCH STUDENTS WITH schoolId === "N/A"
  ---------------------------------------------------- */
  useEffect(() => {
    const q = query(
      collection(db, "PupilsReg"),
      where("schoolId", "==", "N/A")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setStudents(list);
        setLoading(false);
      },
      (error) => {
        console.error(error);
        toast.error("Failed to fetch students");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  /* ----------------------------------------------------
     DELETE STUDENT (BOTH DATABASES)
  ---------------------------------------------------- */
  const handleDelete = async (student) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete ${student.studentName}?\n\nThis action cannot be undone.`
    );

    if (!confirmDelete) return;

    setDeletingId(student.id);

    try {
      // 1️⃣ Delete from MAIN DB
      await deleteDoc(doc(db, "PupilsReg", student.id));

      // 2️⃣ Delete from LOGIN DB (mirror)
      await deleteDoc(
        doc(pupilLoginFetch, "PupilsReg", student.id)
      );

      toast.success("Student deleted successfully");
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete student");
    } finally {
      setDeletingId(null);
    }
  };

  /* ----------------------------------------------------
     UI
  ---------------------------------------------------- */
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold mb-2">
        Pupils Without School ID
      </h2>

      <p className="text-gray-600 mb-4">
        Total records found:{" "}
        <span className="font-semibold">{students.length}</span>
      </p>

      {loading && (
        <div className="text-center py-10 text-gray-500">
          Loading students...
        </div>
      )}

      {!loading && students.length === 0 && (
        <div className="text-center py-10 text-gray-500">
          No students found with schoolId = "N/A"
        </div>
      )}

      {!loading && students.length > 0 && (
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-left">
              <tr>
                <th className="p-3 border">#</th>
                <th className="p-3 border">Student Name</th>
                <th className="p-3 border">Gender</th>
                <th className="p-3 border">Class</th>
                <th className="p-3 border">Academic Year</th>
                <th className="p-3 border">Registered On</th>
                <th className="p-3 border">Registered By</th>
                <th className="p-3 border text-center">Action</th>
              </tr>
            </thead>

            <tbody>
              {students.map((student, index) => (
                <tr
                  key={student.id}
                  className="hover:bg-gray-50"
                >
                  <td className="p-3 border">{index + 1}</td>
                  <td className="p-3 border font-medium">
                    {student.studentName}
                  </td>
                  <td className="p-3 border">
                    {student.gender || "-"}
                  </td>
                  <td className="p-3 border">
                    {student.class || "-"}
                  </td>
                  <td className="p-3 border">
                    {student.academicYear || "-"}
                  </td>
                  <td className="p-3 border">
                    {student.registrationDate || "-"}
                  </td>
                  <td className="p-3 border">
                    {student.registeredBy || "-"}
                  </td>
                  <td className="p-3 border text-center">
                    <button
                      onClick={() => handleDelete(student)}
                      disabled={deletingId === student.id}
                      className="bg-red-600 text-white px-3 py-1 rounded text-xs hover:bg-red-700 disabled:bg-gray-400"
                    >
                      {deletingId === student.id
                        ? "Deleting..."
                        : "Delete"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PupilsWithoutSchool;
