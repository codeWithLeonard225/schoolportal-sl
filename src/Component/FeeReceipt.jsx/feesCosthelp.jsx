import React, { useState, useEffect, useMemo } from "react";
import { db } from "../../../firebase";
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, orderBy, limit } from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";
import { toast } from "react-toastify";

const FeesCostPage = () => {
  const [feesList, setFeesList] = useState([]);
  const [editingFeeId, setEditingFeeId] = useState(null);
  const [classes, setClasses] = useState([]);
  const [searchClass, setSearchClass] = useState("");
  const [selectedClass, setSelectedClass] = useState(null);

  const initialFeeState = useMemo(() => ({
    feeId: uuidv4().slice(0,10).toUpperCase(),
    className: "",
    totalAmount: "",
    academicYear: "",
  }), []);

  const [feeData, setFeeData] = useState(initialFeeState);

  // --- Fetch FeesCost List ---
  useEffect(() => {
    const feesCollectionRef = collection(db, "FeesCost");
    const q = query(feesCollectionRef, orderBy("className", "asc"), limit(50));
    const unsubscribe = onSnapshot(q, snapshot => {
      setFeesList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  // --- Fetch Classes for dropdown/search ---
  useEffect(() => {
    if (!searchClass.trim()) {
      setClasses([]);
      return;
    }
    const classesRef = collection(db, "Classes");
    const q = query(classesRef, where("className", ">=", searchClass), where("className", "<=", searchClass + "\uf8ff"), limit(10));
    const unsubscribe = onSnapshot(q, snapshot => {
      setClasses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [searchClass]);

  const handleClassSelect = (cls) => {
    setSelectedClass(cls);
    setSearchClass(cls.className);
    setFeeData(prev => ({ ...prev, className: cls.className }));
    setClasses([]);
  };

  const handleFeeChange = (e) => {
    const { name, value } = e.target;
    setFeeData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!feeData.className || !feeData.totalAmount || !feeData.academicYear) {
      return toast.error("Please fill all fields.");
    }
    try {
      if (editingFeeId) {
        await updateDoc(doc(db, "FeesCost", editingFeeId), feeData);
        toast.success("Fee updated successfully!");
      } else {
        await addDoc(collection(db, "FeesCost"), feeData);
        toast.success("Fee added successfully!");
      }
      setFeeData(initialFeeState);
      setSelectedClass(null);
      setEditingFeeId(null);
      setSearchClass("");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save fee data.");
    }
  };

  const handleEdit = (fee) => {
    setEditingFeeId(fee.id);
    setFeeData(fee);
    setSelectedClass({ className: fee.className });
    setSearchClass(fee.className);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this fee?")) {
      await deleteDoc(doc(db, "FeesCost", id));
      toast.success("Fee deleted successfully!");
    }
  };

  return (
    <div className="p-6 min-h-screen bg-gray-100">
      <h2 className="text-2xl font-bold mb-4 text-indigo-700">Fees Cost Management</h2>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-lg mb-6 max-w-xl">
        <div className="mb-4">
          <label className="block mb-1 font-medium text-sm">Class Name</label>
          <input
            type="text"
            value={searchClass}
            onChange={e => setSearchClass(e.target.value)}
            placeholder="Search class..."
            className="w-full p-2 border rounded-lg mb-2"
          />
          {selectedClass ? (
            <p className="bg-yellow-100 p-2 rounded">{selectedClass.className}</p>
          ) : (
            <ul className="max-h-32 overflow-y-auto border-t border-gray-300 mt-2">
              {classes.map(cls => (
                <li key={cls.id} onClick={() => handleClassSelect(cls)} className="p-2 cursor-pointer hover:bg-yellow-100 border-b">
                  {cls.className}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mb-4">
          <label className="block mb-1 font-medium text-sm">Total Amount (GHS)</label>
          <input
            type="number"
            name="totalAmount"
            value={feeData.totalAmount}
            onChange={handleFeeChange}
            className="w-full p-2 border rounded-lg"
            required
          />
        </div>

        <div className="mb-4">
          <label className="block mb-1 font-medium text-sm">Academic Year</label>
          <input
            type="text"
            name="academicYear"
            value={feeData.academicYear}
            onChange={handleFeeChange}
            placeholder="e.g., 2025/2026"
            className="w-full p-2 border rounded-lg"
            required
          />
        </div>

        <button type="submit" className={`w-full bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-lg font-semibold`}>
          {editingFeeId ? "Update Fee" : "Add Fee"}
        </button>
      </form>

      {/* Fees Table */}
      <div className="bg-white p-6 rounded-xl shadow-lg max-w-4xl overflow-x-auto">
        <h3 className="text-lg font-bold mb-4">Existing Fees</h3>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-sm font-medium text-gray-500">Fee ID</th>
              <th className="px-3 py-2 text-left text-sm font-medium text-gray-500">Class</th>
              <th className="px-3 py-2 text-left text-sm font-medium text-gray-500">Total Amount</th>
              <th className="px-3 py-2 text-left text-sm font-medium text-gray-500">Academic Year</th>
              <th className="px-3 py-2 text-left text-sm font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {feesList.map(fee => (
              <tr key={fee.id}>
                <td className="px-3 py-2 text-sm text-gray-700">{fee.feeId}</td>
                <td className="px-3 py-2 text-sm text-gray-700">{fee.className}</td>
                <td className="px-3 py-2 text-sm text-green-600 font-bold">GHS {fee.totalAmount}</td>
                <td className="px-3 py-2 text-sm text-gray-700">{fee.academicYear}</td>
                <td className="px-3 py-2 text-sm text-gray-700 space-x-2">
                  <button onClick={() => handleEdit(fee)} className="text-orange-600 hover:text-orange-800">Edit</button>
                  <button onClick={() => handleDelete(fee.id)} className="text-red-600 hover:text-red-800">Delete</button>
                </td>
              </tr>
            ))}
            {feesList.length === 0 && (
              <tr>
                <td colSpan="5" className="text-center p-4 text-gray-500">No fees added yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FeesCostPage;
