import React, { useEffect, useState } from "react";
import { db } from "../../../firebase";
import { pupilLoginFetch } from "../Database/PupilLogin";
import {
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { toast } from "react-toastify";
import { useAuth } from "../Security/AuthContext";

const DeleteClassRecords = () => {
  const { user } = useAuth();
  const schoolId = user?.schoolId || "";

  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [pupils, setPupils] = useState([]); // State for the list
  const [isLoadingPupils, setIsLoadingPupils] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // 1. Fetch unique classes for the dropdown
  useEffect(() => {
    const fetchClasses = async () => {
      if (!schoolId) return;
      try {
        const q = query(collection(db, "PupilsReg"), where("schoolId", "==", schoolId));
        const snapshot = await getDocs(q);
        const classSet = new Set();
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.class) classSet.add(data.class);
        });
        setClasses([...classSet].sort());
      } catch (error) {
        console.error(error);
        toast.error("Failed to load classes");
      }
    };
    fetchClasses();
  }, [schoolId]);

  // 2. Fetch pupils when a class is selected
  useEffect(() => {
    const fetchPupilsByClass = async () => {
      if (!selectedClass || !schoolId) {
        setPupils([]);
        return;
      }

      setIsLoadingPupils(true);
      try {
        const q = query(
          collection(db, "PupilsReg"),
          where("schoolId", "==", schoolId),
          where("class", "==", selectedClass)
        );
        const snapshot = await getDocs(q);
        const pupilList = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        setPupils(pupilList);
      } catch (error) {
        toast.error("Error loading student list");
      } finally {
        setIsLoadingPupils(false);
      }
    };

    fetchPupilsByClass();
  }, [selectedClass, schoolId]);

  // 3. Delete function
  const handleDelete = async () => {
    if (!selectedClass) return toast.error("Select a class first.");
    if (pupils.length === 0) return toast.error("No pupils to delete.");

    const confirmDelete = window.confirm(
      `⚠️ PERMANENT ACTION: Delete ${pupils.length} pupils from ${selectedClass}?`
    );
    if (!confirmDelete) return;

    setIsDeleting(true);
    try {
      for (const pupil of pupils) {
        // Delete from both DBs using the pupil ID we stored
        await deleteDoc(doc(db, "PupilsReg", pupil.id));
        await deleteDoc(doc(pupilLoginFetch, "PupilsReg", pupil.id));
      }

      toast.success(`${pupils.length} pupils deleted successfully.`);
      setPupils([]); // Clear list after deletion
      setSelectedClass(""); // Reset dropdown
    } catch (error) {
      console.error(error);
      toast.error("Delete failed. Check connection.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-xl mx-auto bg-white shadow-lg rounded-xl overflow-hidden border-t-4 border-red-700">
        <div className="p-6">
            <h2 className="text-xl font-bold text-red-700 mb-4">Delete Class Records</h2>

            {/* Dropdown */}
            <label className="text-xs font-bold text-gray-500 uppercase">Select Class</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full border-2 p-3 rounded-lg mb-4 mt-1 outline-red-600 font-semibold"
            >
              <option value="">-- Select Class --</option>
              {classes.map((cls, index) => (
                <option key={index} value={cls}>{cls}</option>
              ))}
            </select>

            {/* Pupil List Preview */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4 border border-dashed border-gray-300">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-bold text-gray-600 uppercase">Class Preview</h3>
                    <span className="bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded-full font-bold">
                        {pupils.length} Students
                    </span>
                </div>

                {isLoadingPupils ? (
                    <p className="text-sm text-center py-4 italic text-gray-400">Loading list...</p>
                ) : pupils.length > 0 ? (
                    <div className="max-h-60 overflow-y-auto divide-y">
                        {pupils.map((pupil, idx) => (
                            <div key={pupil.id} className="py-2 flex justify-between">
                                <span className="text-sm text-gray-700 font-medium">{idx + 1}. {pupil.studentName}</span>
                                <span className="text-[10px] text-gray-400 uppercase font-bold">{pupil.gender}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-center py-4 text-gray-400">No students found in this class.</p>
                )}
            </div>

            <button
              onClick={handleDelete}
              disabled={isDeleting || pupils.length === 0}
              className="w-full bg-red-600 text-white py-4 rounded-xl font-black text-lg hover:bg-red-700 disabled:bg-gray-300 shadow-lg active:scale-95 transition-all"
            >
              {isDeleting ? "Syncing Deletion..." : `Wipe ${pupils.length} Students`}
            </button>
            <p className="text-[10px] text-center mt-3 text-red-500 font-bold uppercase">⚠️ Warning: This cannot be undone</p>
        </div>
      </div>
    </div>
  );
};

export default DeleteClassRecords;