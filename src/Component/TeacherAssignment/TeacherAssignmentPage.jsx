import React, { useState, useEffect, useMemo } from "react";
import { db } from "../../../firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  updateDoc,
  doc,
  query,
  where,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";
import { useLocation } from "react-router-dom";

const TeacherAssignmentPage = () => {
  // --- Constants and State ---
  const DELETE_PASSWORD = "1234";
  const location = useLocation();
  const schoolId = location.state?.schoolId || "N/A";

  const [teacher, setTeacher] = useState("");
  const [className, setClassName] = useState("");
  const [subjectList, setSubjectList] = useState([]);
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [classesAndSubjects, setClassesAndSubjects] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [editingId, setEditingId] = useState(null);

  // Search/Filter state
  const [searchTerm, setSearchTerm] = useState("");

  // Delete modal state
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [deleteMode, setDeleteMode] = useState("single"); // "single" | "all"
  const [deleteId, setDeleteId] = useState(null);
  const [deletePasswordInput, setDeletePasswordInput] = useState("");
  const [assignmentToDelete, setAssignmentToDelete] = useState(null);

  // 🔹 Helper: Clear localStorage cache for a teacher
  const clearTeacherCache = (teacherName) => {
    const teacherData = teachers.find(
      (t) => t.fullName === teacherName || t.teacherName === teacherName
    );
    const teacherKey = teacherData?.teacherName || teacherName;

    if (teacherKey) {
      const assignmentsKey = `assignments_${teacherKey}_${schoolId}`;
      localStorage.removeItem(assignmentsKey);
      console.log(`Cleared local storage cache for: ${assignmentsKey}`);
    }
  };

  // 🔹 Fetch teachers by schoolId
  useEffect(() => {
    if (schoolId === "N/A") return;
    const q = query(
      collection(db, "Teachers"),
      where("schoolId", "==", schoolId)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setTeachers(data);
    });
    return () => unsub();
  }, [schoolId]);

  // 🔹 Fetch classes & subjects by schoolId
  useEffect(() => {
    if (schoolId === "N/A") return;
    const q = query(
      collection(db, "ClassesAndSubjects"),
      where("schoolId", "==", schoolId)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setClassesAndSubjects(data);
    });
    return () => unsub();
  }, [schoolId]);

  // 🔹 Update subject list based on selected class
  useEffect(() => {
    if (!className) {
      setSubjectList([]);
      setSelectedSubjects([]);
      return;
    }
    const selectedClass = classesAndSubjects.find(
      (cls) => cls.className === className
    );
    setSubjectList(selectedClass ? selectedClass.subjects : []);
    setSelectedSubjects((prev) =>
      prev.filter((subject) => selectedClass?.subjects.includes(subject))
    );
  }, [className, classesAndSubjects]);

  // 🔹 Handle subject checkbox toggle
  const handleSubjectToggle = (subject) => {
    if (selectedSubjects.includes(subject)) {
      setSelectedSubjects(selectedSubjects.filter((s) => s !== subject));
    } else {
      setSelectedSubjects([...selectedSubjects, subject]);
    }
  };

  // 🔹 Assign or update teacher
  const handleAssign = async () => {
    if (!teacher || !className || selectedSubjects.length === 0) {
      alert("Please select a teacher, class, and at least one subject.");
      return;
    }

    try {
      if (editingId) {
        const assignmentRef = doc(db, "TeacherAssignments", editingId);
        await updateDoc(assignmentRef, {
          teacher,
          className,
          subjects: selectedSubjects,
        });
        setEditingId(null);
        alert("Assignment updated successfully!");
        clearTeacherCache(teacher);
      } else {
        await addDoc(collection(db, "TeacherAssignments"), {
          teacher,
          className,
          subjects: selectedSubjects,
          schoolId,
          createdAt: new Date(),
        });
        alert("Teacher assigned successfully!");
        clearTeacherCache(teacher);
      }

      setTeacher("");
      setClassName("");
      setSelectedSubjects([]);
    } catch (err) {
      console.error(err);
      alert("Error saving assignment.");
    }
  };

  // 🔹 Fetch assignments by schoolId
  useEffect(() => {
    if (schoolId === "N/A") return;
    const q = query(
      collection(db, "TeacherAssignments"),
      where("schoolId", "==", schoolId)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setAssignments(data);
    });
    return () => unsub();
  }, [schoolId]);

  // 🔹 Filter assignments
  const filteredAssignments = useMemo(() => {
    if (!searchTerm) return assignments;
    const lowerCaseSearchTerm = searchTerm.toLowerCase();

    return assignments.filter(
      (assign) =>
        assign.teacher.toLowerCase().includes(lowerCaseSearchTerm) ||
        assign.className.toLowerCase().includes(lowerCaseSearchTerm) ||
        assign.subjects.some((subject) =>
          subject.toLowerCase().includes(lowerCaseSearchTerm)
        )
    );
  }, [assignments, searchTerm]);

  // 🔹 Edit existing assignment
  const handleEdit = (assignment) => {
    setEditingId(assignment.id);
    setTeacher(assignment.teacher);
    setClassName(assignment.className);
    setSelectedSubjects(assignment.subjects);
  };

  // 🔹 Open Delete Popup for 1 Single Item
  const handleOpenSingleDelete = (assignment) => {
    setDeleteMode("single");
    setDeleteId(assignment.id);
    setAssignmentToDelete(assignment);
    setDeletePasswordInput("");
    setShowDeletePopup(true);
  };

  // 🔹 Open Delete Popup for ALL Items
  const handleOpenDeleteAll = () => {
    if (assignments.length === 0) {
      alert("There are no assignments to delete.");
      return;
    }
    setDeleteMode("all");
    setDeleteId(null);
    setAssignmentToDelete(null);
    setDeletePasswordInput("");
    setShowDeletePopup(true);
  };

  // 🔹 Execute Deletion (Single or All)
  const handleDeleteConfirm = async () => {
    if (deletePasswordInput !== DELETE_PASSWORD) {
      alert("Invalid password.");
      return;
    }

    try {
      if (deleteMode === "single") {
        if (!deleteId) return;

        await deleteDoc(doc(db, "TeacherAssignments", deleteId));
        clearTeacherCache(assignmentToDelete.teacher);

        alert(
          `Assignment for ${assignmentToDelete.teacher} (${assignmentToDelete.className}) deleted successfully!`
        );
      } else if (deleteMode === "all") {
        const batch = writeBatch(db);

        assignments.forEach((assign) => {
          const ref = doc(db, "TeacherAssignments", assign.id);
          batch.delete(ref);
          clearTeacherCache(assign.teacher);
        });

        await batch.commit();
        alert(`All ${assignments.length} assignments have been deleted successfully!`);
      }

      handleCloseDeletePopup();
    } catch (err) {
      console.error("Error deleting assignment(s):", err);
      alert("Error processing deletion. Please try again.");
    }
  };

  // 🔹 Close Delete Confirmation Popup
  const handleCloseDeletePopup = () => {
    setShowDeletePopup(false);
    setDeleteMode("single");
    setDeleteId(null);
    setAssignmentToDelete(null);
    setDeletePasswordInput("");
  };

  return (
    <div className="max-w-5xl mx-auto p-6 bg-white rounded-2xl shadow-md relative">
      <h2 className="text-2xl font-semibold mb-4 text-center text-gray-800">
        Teacher Class & Subject Assignment
      </h2>

      {/* School ID display */}
      <div className="text-center text-sm text-gray-500 mb-4">
        School ID: <span className="font-semibold">{schoolId}</span>
      </div>

      {/* Form Inputs */}
      <div className="space-y-4 mb-8">
        <div>
          <label className="font-medium text-gray-700">Select Teacher:</label>
          <select
            value={teacher}
            onChange={(e) => setTeacher(e.target.value)}
            className="w-full border rounded-md px-3 py-2 mt-1 focus:ring focus:ring-blue-300 bg-white"
          >
            <option value="">-- Select Teacher --</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.fullName || t.teacherName}>
                {t.fullName || t.teacherName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="font-medium text-gray-700">Select Class:</label>
          <select
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            className="w-full border rounded-md px-3 py-2 mt-1 focus:ring focus:ring-blue-300 bg-white"
          >
            <option value="">-- Select Class --</option>
            {classesAndSubjects.map((cls) => (
              <option key={cls.id} value={cls.className}>
                {cls.className}
              </option>
            ))}
          </select>
        </div>

        {subjectList.length > 0 && (
          <div>
            <label className="font-medium text-gray-700">Select Subjects:</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
              {subjectList.map((subject, index) => (
                <label
                  key={index}
                  className="flex items-center space-x-2 border rounded-md px-2 py-1 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedSubjects.includes(subject)}
                    onChange={() => handleSubjectToggle(subject)}
                    className="form-checkbox"
                  />
                  <span>{subject}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={handleAssign}
          className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 font-medium"
        >
          {editingId ? "Update Assignment" : "Assign Teacher"}
        </button>
      </div>

      {/* Header and Bulk Delete Action */}
      <div className="flex justify-between items-center mt-8 mb-3">
        <h3 className="text-xl font-semibold text-gray-800">Assigned Teachers</h3>
        {assignments.length > 0 && (
          <button
            onClick={handleOpenDeleteAll}
            className="bg-red-700 text-white px-3 py-1.5 rounded-md hover:bg-red-800 text-xs font-semibold shadow-sm transition"
          >
            Delete All ({assignments.length})
          </button>
        )}
      </div>

      {/* Search Input */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Filter by Teacher, Class, or Subject..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full border rounded-md px-4 py-2 focus:ring focus:ring-indigo-300"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-300 rounded-md text-sm">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="border px-3 py-2 text-left">#</th>
              <th className="border px-3 py-2 text-left">Teacher</th>
              <th className="border px-3 py-2 text-left">Class</th>
              <th className="border px-3 py-2 text-left">Subjects</th>
              <th className="border px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAssignments.length === 0 ? (
              <tr>
                <td colSpan="5" className="text-center py-4 text-gray-500">
                  {searchTerm
                    ? "No assignments match your search."
                    : "No assignments yet."}
                </td>
              </tr>
            ) : (
              filteredAssignments.map((assign, index) => (
                <tr key={assign.id} className="hover:bg-gray-50">
                  <td className="border px-3 py-2">{index + 1}</td>
                  <td className="border px-3 py-2 font-semibold">{assign.teacher}</td>
                  <td className="border px-3 py-2">{assign.className}</td>
                  <td className="border px-3 py-2">{assign.subjects.join(", ")}</td>
                  <td className="border px-3 py-2 flex gap-2">
                    <button
                      onClick={() => handleEdit(assign)}
                      className="bg-yellow-400 text-white px-3 py-1 rounded-md hover:bg-yellow-500 text-xs"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleOpenSingleDelete(assign)}
                      className="bg-red-600 text-white px-3 py-1 rounded-md hover:bg-red-700 text-xs"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Delete Modal (Handles Both Single and Bulk Delete) */}
      {showDeletePopup && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full">
            <h3 className="text-lg font-bold mb-3 text-red-600">
              {deleteMode === "all" ? "Confirm Delete All" : "Confirm Deletion"}
            </h3>

            <div className="text-gray-700 mb-4 text-sm">
              {deleteMode === "all" ? (
                <p>
                  Are you sure you want to delete <strong className="text-red-600">ALL {assignments.length} assignments</strong> for school ID <strong>{schoolId}</strong>?
                  This action cannot be undone.
                </p>
              ) : (
                <p>
                  Are you sure you want to delete this assignment?
                  <br />
                  Teacher: <strong>{assignmentToDelete?.teacher}</strong>
                  <br />
                  Class: <strong>{assignmentToDelete?.className}</strong>
                </p>
              )}
            </div>

            <label className="block text-sm font-medium text-gray-700 mb-1">
              Enter Password ({DELETE_PASSWORD}):
            </label>
            <input
              type="password"
              value={deletePasswordInput}
              onChange={(e) => setDeletePasswordInput(e.target.value)}
              className="w-full border rounded-md px-3 py-2 mb-4 focus:ring focus:ring-red-300"
              placeholder={DELETE_PASSWORD}
            />

            <div className="flex justify-end gap-3">
              <button
                onClick={handleCloseDeletePopup}
                className="px-4 py-2 bg-gray-300 rounded-md hover:bg-gray-400 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-red-400 text-sm font-semibold"
                disabled={deletePasswordInput !== DELETE_PASSWORD}
              >
                {deleteMode === "all" ? "Delete All" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherAssignmentPage;