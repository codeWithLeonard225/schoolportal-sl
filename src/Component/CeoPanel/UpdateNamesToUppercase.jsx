import React, { useState } from "react";
import { collection, getDocs, updateDoc, doc } from "firebase/firestore";
import { db } from "../../../firebase";
import { toast } from "react-toastify";

const UpdateNamesToUppercase = () => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [updatedCount, setUpdatedCount] = useState(0);
  const [progress, setProgress] = useState(0);

  const handleBulkUpdate = async () => {
    if (!window.confirm("Are you sure you want to update all student names to uppercase?")) {
      return;
    }

    try {
      setIsUpdating(true);
      setUpdatedCount(0);
      setProgress(0);

      // Fetch all students
      const snapshot = await getDocs(collection(db, "PupilsReg"));

      if (snapshot.empty) {
        toast.info("No students found in PupilsReg collection.");
        setIsUpdating(false);
        return;
      }

      const total = snapshot.docs.length;
      let count = 0;

      for (const docSnap of snapshot.docs) {
        const student = docSnap.data();
        const name = student.studentName;

        if (name && name !== name.toUpperCase()) {
          await updateDoc(doc(db, "PupilsReg", docSnap.id), {
            studentName: name.toUpperCase().trim(),
          });
          count++;
        }

        // Update progress bar after each iteration
        setProgress(Math.round(((count + 1) / total) * 100));
      }

      setUpdatedCount(count);
      toast.success(`${count} student names updated to uppercase!`);
    } catch (error) {
      console.error("Error updating names:", error);
      toast.error("Failed to update names.");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-100 p-6">
      <div className="bg-white p-8 rounded-2xl shadow-md w-full max-w-md text-center">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">Update Student Names</h2>
        <p className="text-gray-600 mb-6">
          This will convert all student names in <strong>PupilsReg</strong> to uppercase.
        </p>

        <button
          onClick={handleBulkUpdate}
          disabled={isUpdating}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400"
        >
          {isUpdating ? "Updating..." : "Update All to Uppercase"}
        </button>

        {/* Progress Bar */}
        {isUpdating && (
          <div className="w-full mt-6 bg-gray-200 rounded-full h-4">
            <div
              className="bg-blue-600 h-4 rounded-full transition-all duration-300 ease-in-out"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        )}

        {/* Progress Text */}
        {isUpdating && (
          <p className="mt-2 text-gray-700 font-semibold">{progress}% completed</p>
        )}

        {/* Summary */}
        {updatedCount > 0 && !isUpdating && (
          <p className="mt-4 text-green-600 font-semibold">
            ✅ {updatedCount} names successfully updated!
          </p>
        )}
      </div>
    </div>
  );
};

export default UpdateNamesToUppercase;
