import React, { useState, useEffect } from "react";
import { db } from "../../../firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { toast } from "react-toastify";
import { v4 as uuidv4 } from "uuid";
import CloudinaryImageUploader from "../CaptureCamera/CloudinaryImageUploader";
import CameraCapture from "../CaptureCamera/CameraCapture";

const CLOUD_NAME = "doucdnzij";
const UPLOAD_PRESET = "Nardone";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const SchoolRegistration = () => {
  const [formData, setFormData] = useState({
    schoolID: uuidv4().slice(0, 8),
    schoolName: "",
    schoolLogoUrl: "",
    schoolAddress: "",
    schoolMotto: "",
    schoolContact: "",
    principalName: "",
    email: "",
    registrationDate: new Date().toISOString().slice(0, 10),
  });

  const [schools, setSchools] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showCamera, setShowCamera] = useState({ open: false, field: "" });
  const [editingId, setEditingId] = useState(null);

  // Fetch registered schools
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "Schools"), (snapshot) => {
      const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setSchools(list);
    });
    return () => unsubscribe();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleUploadSuccess = (url, fieldName) => {
    setFormData((prev) => ({ ...prev, [fieldName]: url }));
    toast.success(
      `${fieldName === "schoolLogoUrl" ? "School Logo" : "Country Logo"} uploaded successfully!`
    );
  };

  const handleCameraCapture = async (base64Data, fieldName) => {
    setIsUploading(true);
    setUploadProgress(0);
    try {
      const res = await fetch(base64Data);
      const blob = await res.blob();
      if (blob.size > MAX_FILE_SIZE) {
        toast.error("Image too large (Max 5MB)");
        setIsUploading(false);
        return;
      }

      const formDataObj = new FormData();
      formDataObj.append("file", blob);
      formDataObj.append("upload_preset", UPLOAD_PRESET);
      formDataObj.append("folder", "SchoolApp/Logos");

      const uploadRes = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        { method: "POST", body: formDataObj }
      );

      const data = await uploadRes.json();
      handleUploadSuccess(data.secure_url, fieldName);
    } catch (err) {
      console.error("Camera upload failed:", err);
      toast.error("Upload failed.");
    } finally {
      setIsUploading(false);
      setShowCamera({ open: false, field: "" });
    }
  };

  const resetForm = () => {
    setFormData({
      schoolID: uuidv4().slice(0, 8),
      schoolName: "",
      schoolLogoUrl: "",
      schoolAddress: "",
      schoolMotto: "",
      schoolContact: "",
      principalName: "",
      email: "",
      registrationDate: new Date().toISOString().slice(0, 10),
    });
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Assuming 'location' was meant to be 'schoolAddress' or another field is required.
    // I'll keep the original check but replace 'location' with 'schoolAddress' as it exists in state.
    if (!formData.schoolName || !formData.schoolAddress) {
      toast.error("Please fill in all required fields.");
      return;
    }
    setIsSubmitting(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, "Schools", editingId), formData);
        toast.success("School updated successfully!");
      } else {
        await addDoc(collection(db, "Schools"), {
          ...formData,
          createdAt: new Date(),
        });
        toast.success("School registered successfully!");
      }
      resetForm();
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to save school data.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (school) => {
    setFormData({ ...school });
    setEditingId(school.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this school?")) {
      try {
        await deleteDoc(doc(db, "Schools", id));
        toast.success("School deleted successfully!");
      } catch (err) {
        console.error(err);
        toast.error("Failed to delete school.");
      }
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-100 p-6 space-y-6">
      {/* Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-white shadow-lg rounded-2xl p-6 w-full max-w-3xl space-y-6"
      >
        <h2 className="text-2xl font-bold text-center mb-4">
          {editingId ? "Edit School" : "School Registration"}
        </h2>

        {/* Input Fields Grid with Labels */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* School ID */}
          <div className="flex flex-col">
            <label htmlFor="schoolID" className="font-medium text-sm mb-1">
              School ID
            </label>
            <input
              type="text"
              id="schoolID"
              name="schoolID"
              value={formData.schoolID}
              readOnly
              className="w-full p-2 border rounded-lg bg-gray-100"
              placeholder="School ID"
            />
          </div>

          {/* School Name */}
          <div className="flex flex-col">
            <label htmlFor="schoolName" className="font-medium text-sm mb-1">
              School Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="schoolName"
              name="schoolName"
              value={formData.schoolName}
              onChange={handleChange}
              className="w-full p-2 border rounded-lg"
              placeholder="Enter school name"
              required
            />
          </div>

          {/* Principal Name */}
          <div className="flex flex-col">
            <label htmlFor="principalName" className="font-medium text-sm mb-1">
              Principal Name
            </label>
            <input
              type="text"
              id="principalName"
              name="principalName"
              value={formData.principalName}
              onChange={handleChange}
              className="w-full p-2 border rounded-lg"
              placeholder="Enter principal's name"
            />
          </div>

          {/* School Address */}
          <div className="flex flex-col">
            <label htmlFor="schoolAddress" className="font-medium text-sm mb-1">
              School Address <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="schoolAddress"
              name="schoolAddress"
              value={formData.schoolAddress}
              onChange={handleChange}
              className="w-full p-2 border rounded-lg"
              placeholder="Enter school address"
              required
            />
          </div>

          {/* Email */}
          <div className="flex flex-col">
            <label htmlFor="email" className="font-medium text-sm mb-1">
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full p-2 border rounded-lg"
              placeholder="Enter email address"
            />
          </div>

          {/* School Motto */}
          <div className="flex flex-col">
            <label htmlFor="schoolMotto" className="font-medium text-sm mb-1">
              School Motto
            </label>
            <input
              type="text"
              id="schoolMotto"
              name="schoolMotto"
              value={formData.schoolMotto}
              onChange={handleChange}
              className="w-full p-2 border rounded-lg"
              placeholder="Enter school motto"
            />
          </div>

          {/* School Contact */}
          <div className="flex flex-col">
            <label htmlFor="schoolContact" className="font-medium text-sm mb-1">
              School Contact
            </label>
            <input
              type="text"
              id="schoolContact"
              name="schoolContact"
              value={formData.schoolContact}
              onChange={handleChange}
              className="w-full p-2 border rounded-lg"
              placeholder="Enter school contact number"
            />
          </div>

          {/* Registration Date */}
          <div className="flex flex-col">
            <label htmlFor="registrationDate" className="font-medium text-sm mb-1">
              Registration Date
            </label>
            <input
              type="date"
              id="registrationDate"
              name="registrationDate"
              value={formData.registrationDate}
              onChange={handleChange}
              className="w-full p-2 border rounded-lg"
            />
          </div>
        </div>

        {/* Logos */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="font-medium text-sm mb-1 block">School Logo</label>
            <CloudinaryImageUploader
              onUploadSuccess={(url) => handleUploadSuccess(url, "schoolLogoUrl")}
              onUploadStart={() => setIsUploading(true)}
              onUploadProgress={setUploadProgress}
              onUploadComplete={() => setIsUploading(false)}
            />
            <button
              type="button"
              onClick={() => setShowCamera({ open: true, field: "schoolLogoUrl" })}
              className="mt-2 bg-green-600 text-white px-4 py-1 rounded-md text-sm"
            >
              Use Camera
            </button>
          </div>
          {/* Note: The country logo upload was removed in the original component, 
              but you might want to add another file uploader here if needed. 
              Keeping the flex-row structure for future expansion. */}
        </div>

        {isUploading && (
          <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
            <div
              className="bg-indigo-600 h-2 rounded-full"
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            {isSubmitting ? "Saving..." : editingId ? "Update School" : "Register School"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="flex-1 bg-gray-500 text-white py-2 rounded-lg hover:bg-gray-600"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* Schools Table - Omitted for brevity, as it was not changed */}
      {/* ... (rest of the component, including the table and CameraCapture modal) */}

      <div className="w-full max-w-6xl overflow-x-auto">
        <table className="w-full table-auto bg-white shadow-lg rounded-xl overflow-hidden">
          <thead className="bg-gray-200">
            <tr>
              {[
                "ID",
                "Name",
                "Principal",
                "Address",
                "Email",
                "Motto",
                "School Contact",
                "Registration Date",
                "School Logo",
                "Actions",
              ].map((header) => (
                <th key={header} className="border p-2 text-left text-sm">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {schools.map((school) => (
              <tr key={school.id} className="hover:bg-gray-100">
                <td className="border p-2 text-sm">{school.schoolID}</td>
                <td className="border p-2 text-sm">{school.schoolName}</td>
                <td className="border p-2 text-sm">{school.principalName}</td>
                <td className="border p-2 text-sm">{school.schoolAddress}</td>
                <td className="border p-2 text-sm">{school.email}</td>
                <td className="border p-2 text-sm">{school.schoolMotto}</td>
                <td className="border p-2 text-sm">{school.schoolContact}</td>
                <td className="border p-2 text-sm">{school.registrationDate}</td>
                <td className="border p-2 text-sm">
                  {school.schoolLogoUrl && (
                    <img
                      src={school.schoolLogoUrl}
                      alt="school logo"
                      className="h-10 w-10 object-cover rounded-full"
                    />
                  )}
                </td>
                <td className="border p-2 text-sm space-x-2">
                  <button
                    onClick={() => handleEdit(school)}
                    className="bg-yellow-500 text-white px-2 py-1 rounded hover:bg-yellow-600"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(school.id)}
                    className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Camera Modal */}
      {showCamera.open && (
        <CameraCapture
          setPhoto={(data) => handleCameraCapture(data, showCamera.field)}
          onClose={() => setShowCamera({ open: false, field: "" })}
        />
      )}
    </div>
  );
};

export default SchoolRegistration;