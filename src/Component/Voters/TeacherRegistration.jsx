import React, { useState, useEffect, useMemo } from "react";
import CameraCapture from "../CaptureCamera/CameraCapture";
import CloudinaryImageUploader from "../CaptureCamera/CloudinaryImageUploader";
import { toast } from "react-toastify";
import { db } from "../../../firebase";
import {
    collection,
    addDoc,
    doc,
    deleteDoc,
    updateDoc,
    query,
    onSnapshot,
    getDocs,
    where,
} from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";
import { useLocation } from "react-router-dom";
import localforage from "localforage"; // ⬅️ Import localforage for caching

// Cloudinary config
const CLOUD_NAME = "dxcrlpike"; // Cloudinary Cloud Name
const UPLOAD_PRESET = "LeoTechSl Projects"; // Cloudinary Upload Preset
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ADMIN_PASSWORD = "1234";

// Initialize localforage store
const teacherStore = localforage.createInstance({
    name: "TeacherRegistrationCache",
    storeName: "teachersData",
});

const TeacherRegistration = () => {
    const location = useLocation();
    const schoolId = location.state?.schoolId || "N/A";
    const CACHE_KEY = `teachers_list_${schoolId}`; // Key specific to schoolId

    const [formData, setFormData] = useState({
        id: null,
        teacherID: uuidv4().slice(0, 8),
        teacherName: "",
        gender: "",
        phone: "",
        email: "",
        address: "",
        registrationDate: new Date().toISOString().slice(0, 10),
        registeredBy: "",
        userPhoto: null,
        userPublicId: null,
        schoolId: schoolId,
    });

    const [searchTerm, setSearchTerm] = useState("");
    const [showCamera, setShowCamera] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [teachers, setTeachers] = useState([]);
    const [loading, setLoading] = useState(true); // ⬅️ Added loading state

    // 🧠 Fetch and Cache Teachers list
    useEffect(() => {
        if (schoolId === "N/A") {
            setLoading(false);
            return;
        }

        const loadAndListen = async () => {
            setLoading(true);

            // 🚀 Step 1: Attempt to load from localforage cache (FAST initial load)
            try {
                const cachedItem = await teacherStore.getItem(CACHE_KEY);
                if (cachedItem && cachedItem.data && cachedItem.data.length > 0) {
                    setTeachers(cachedItem.data);
                    setLoading(false); // Initial load complete via cache
                    console.log("Loaded initial teachers from IndexDB cache.");
                }
            } catch (e) {
                console.error("Failed to retrieve cached teachers:", e);
                // Continue to Firebase fetch if cache fails
            }

            // 🚀 Step 2: Set up Firestore Listener (Starts immediately)
            const collectionRef = collection(db, "Teachers");
            const q = query(collectionRef, where("schoolId", "==", schoolId));

            const unsubscribe = onSnapshot(
                q,
                (snapshot) => {
                    const fetchedData = snapshot.docs.map((doc) => ({
                        id: doc.id,
                        ...doc.data(),
                    }));
                    
                    // Update UI state with new data
                    setTeachers(fetchedData);

                    // 🚀 Step 3: Save fresh data to localforage
                    const dataToStore = {
                        timestamp: Date.now(),
                        data: fetchedData,
                    };
                    teacherStore.setItem(CACHE_KEY, dataToStore)
                        .catch(e => console.error("Failed to save teachers to IndexDB:", e));

                    setLoading(false); // Loading is done once the first snapshot arrives (or cache loaded)
                    console.log("Teachers list updated via real-time Firestore listener.");
                },
                (error) => {
                    console.error("Firestore Teachers onSnapshot failed:", error);
                    toast.error("Failed to load teacher data.");
                    setLoading(false);
                }
            );

            return () => unsubscribe(); // Cleanup listener on unmount
        };

        loadAndListen();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [schoolId]);

    // 🔍 Filter teachers by name or ID (unchanged)
    const filteredTeachers = useMemo(() => {
        if (!searchTerm.trim()) return teachers;

        const lower = searchTerm.toLowerCase();
        return teachers.filter(
            (t) =>
                t.teacherName?.toLowerCase().includes(lower) ||
                t.teacherID?.toLowerCase().includes(lower)
        );
    }, [teachers, searchTerm]);

    // Handle input (unchanged)
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    // Handle upload success (unchanged)
    const handleUploadSuccess = (url, publicId) => {
        setFormData((prev) => ({
            ...prev,
            userPhoto: url,
            userPublicId: publicId,
        }));
        toast.success("Photo uploaded successfully!");
    };

    // Handle camera capture (unchanged)
    const handleCameraCapture = async (base64Data) => {
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
            formDataObj.append("folder", "SchoolApp/Teachers");

            const resUpload = await fetch(
                `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
                {
                    method: "POST",
                    body: formDataObj,
                }
            );

            const data = await resUpload.json();
            handleUploadSuccess(data.secure_url, data.public_id);
        } catch (err) {
            console.error("Camera upload failed:", err);
            toast.error("Failed to upload image.");
        } finally {
            setIsUploading(false);
            setShowCamera(false);
        }
    };

    // Handle submit (unchanged, but includes the cascade update logic)
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.teacherName.trim()) {
            toast.error("Teacher name is required.");
            return;
        }

        setIsSubmitting(true);

        const oldTeacherName = teachers.find(t => t.id === formData.id)?.teacherName;

        try {
            const newTeacherName = formData.teacherName.trim().toUpperCase();

            const teacherData = {
                teacherID: formData.teacherID,
                teacherName: newTeacherName,
                gender: formData.gender,
                phone: formData.phone,
                email: formData.email,
                address: formData.address,
                registrationDate: formData.registrationDate,
                registeredBy: formData.registeredBy,
                userPhotoUrl: formData.userPhoto,
                userPublicId: formData.userPublicId,
                schoolId: formData.schoolId,
            };

            if (formData.id) {
                // --- START: Update Logic ---
                const teacherRef = doc(db, "Teachers", formData.id);
                await updateDoc(teacherRef, teacherData);

                // 💥 Step 2: Cascade Update in TeacherAssignments
                if (oldTeacherName && oldTeacherName !== newTeacherName) {
                    // Query assignments with the OLD teacher name and current school ID
                    const assignmentsQuery = query(
                        collection(db, "TeacherAssignments"),
                        where("teacher", "==", oldTeacherName),
                        where("schoolId", "==", schoolId)
                    );

                    const snapshot = await getDocs(assignmentsQuery); // Use getDocs for one-time fetch

                    const updatePromises = snapshot.docs.map(assignmentDoc => {
                        const assignmentRef = doc(db, "TeacherAssignments", assignmentDoc.id);
                        return updateDoc(assignmentRef, {
                            teacher: newTeacherName, // Update to the new name
                        });
                    });

                    await Promise.all(updatePromises);
                    toast.success(`Teacher and ${updatePromises.length} assignment(s) updated successfully!`);
                } else {
                    toast.success("Teacher updated successfully!");
                }
                // --- END: Update Logic ---
            } else {
                // Standard Add Logic
                await addDoc(collection(db, "Teachers"), {
                    ...teacherData,
                    timestamp: new Date(),
                });
                toast.success("Teacher registered successfully!");
            }

            // Reset form
            setFormData({
                id: null,
                teacherID: uuidv4().slice(0, 8),
                teacherName: "",
                gender: "",
                phone: "",
                email: "",
                address: "",
                registrationDate: new Date().toISOString().slice(0, 10),
                registeredBy: "",
                userPhoto: null,
                userPublicId: null,
                schoolId: schoolId,
            });
        } catch (err) {
            console.error(err);
            toast.error("Failed to save teacher data.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Edit existing teacher (unchanged)
    const handleUpdate = (teacher) => {
        setFormData({
            id: teacher.id,
            teacherID: teacher.teacherID,
            teacherName: teacher.teacherName,
            gender: teacher.gender || "",
            phone: teacher.phone || "",
            email: teacher.email || "",
            address: teacher.address || "",
            registrationDate: teacher.registrationDate,
            registeredBy: teacher.registeredBy,
            userPhoto: teacher.userPhotoUrl,
            userPublicId: teacher.userPublicId,
            schoolId: teacher.schoolId || schoolId,
        });
        toast.info(`Editing teacher: ${teacher.teacherName}`);
    };

    // Delete teacher (unchanged)
    const handleDelete = async (id, teacherName) => {
        const password = window.prompt("Enter admin password to delete:");
        if (password === ADMIN_PASSWORD) {
            if (window.confirm(`Delete teacher: ${teacherName}?`)) {
                try {
                    await deleteDoc(doc(db, "Teachers", id));
                    toast.success("Teacher deleted successfully!");
                } catch (err) {
                    console.error(err);
                    toast.error("Failed to delete teacher.");
                }
            }
        } else if (password !== null) {
            toast.error("Incorrect password.");
        }
    };

    // Show loading spinner if necessary
    if (loading && teachers.length === 0) {
        return (
            <div className="p-6 text-center">
                <p className="text-xl font-medium text-gray-700">Loading teacher data...</p>
                <p className="text-sm text-gray-500 mt-2">Checking local cache or fetching from server.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center min-h-screen bg-gray-100 p-6 space-y-6">
            {/* ---------------- FORM ---------------- */}
            <form
                onSubmit={handleSubmit}
                className="bg-white shadow-lg rounded-2xl p-6 w-full max-w-2xl"
            >
                <h2 className="text-2xl font-bold text-center mb-4">
                    {formData.id ? "Update Teacher" : "Teacher Registration"} 🧑‍🏫
                </h2>

                <div className="flex flex-col md:flex-row md:space-x-4">
                    <div className="flex-1">
                        <label className="block mb-2 font-medium text-sm">Teacher ID</label>
                        <input
                            type="text"
                            name="teacherID"
                            value={formData.teacherID}
                            readOnly
                            className="w-full p-2 mb-4 border rounded-lg bg-gray-100"
                        />
                    </div>
                    <div className="flex-1">
                        <label className="block mb-2 font-medium text-sm">Teacher Name</label>
                        <input
                            type="text"
                            name="teacherName"
                            value={formData.teacherName}
                            onChange={handleInputChange}
                            className="w-full p-2 mb-4 border rounded-lg"
                            required
                        />
                    </div>
                </div>

                <div className="flex flex-col md:flex-row md:space-x-4">
                    <div className="flex-1">
                        <label className="block mb-2 font-medium text-sm">Gender</label>
                        <select
                            name="gender"
                            value={formData.gender}
                            onChange={handleInputChange}
                            className="w-full p-2 mb-4 border rounded-lg"
                        >
                            <option value="">Select Gender</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className="block mb-2 font-medium text-sm">Phone</label>
                        <input
                            type="tel"
                            name="phone"
                            value={formData.phone}
                            onChange={handleInputChange}
                            className="w-full p-2 mb-4 border rounded-lg"
                        />
                    </div>
                </div>

                <div>
                    <label className="block mb-2 font-medium text-sm">Email</label>
                    <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className="w-full p-2 mb-4 border rounded-lg"
                    />
                </div>

                <div>
                    <label className="block mb-2 font-medium text-sm">Address</label>
                    <input
                        type="text"
                        name="address"
                        value={formData.address}
                        onChange={handleInputChange}
                        className="w-full p-2 mb-4 border rounded-lg"
                    />
                </div>

                <div className="flex flex-col md:flex-row md:space-x-4">
                    <div className="flex-1">
                        <label className="block mb-2 font-medium text-sm">
                            Registration Date
                        </label>
                        <input
                            type="date"
                            name="registrationDate"
                            value={formData.registrationDate}
                            onChange={handleInputChange}
                            className="w-full p-2 mb-4 border rounded-lg"
                        />
                    </div>
                    <div className="flex-1">
                        <label className="block mb-2 font-medium text-sm">
                            Registered By
                        </label>
                        <input
                            type="text"
                            name="registeredBy"
                            value={formData.registeredBy}
                            onChange={handleInputChange}
                            className="w-full p-2 mb-4 border rounded-lg"
                            placeholder="Enter Staff ID"
                        />
                    </div>
                </div>

                {/* Photo Upload */}
                <div className="flex flex-col items-center mb-4 border-t pt-4">
                    <label className="mb-2 font-medium text-sm">Teacher Photo</label>
                    <div className="border-4 border-dashed w-36 h-48 flex items-center justify-center bg-white/30 mb-2">
                        {formData.userPhoto ? (
                            <img
                                src={formData.userPhoto}
                                alt="Teacher"
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            "2-inch Photo"
                        )}
                    </div>
                    <CloudinaryImageUploader
                        onUploadSuccess={handleUploadSuccess}
                        onUploadStart={() => {
                            setIsUploading(true);
                            setUploadProgress(0);
                        }}
                        onUploadProgress={setUploadProgress}
                        onUploadComplete={() => setIsUploading(false)}
                    />
                    <button
                        type="button"
                        onClick={() => setShowCamera(true)}
                        className="w-full sm:w-auto bg-green-600 text-white py-2 px-6 rounded-md text-sm font-semibold mt-2"
                        disabled={isUploading}
                    >
                        Use Camera
                    </button>
                    {isUploading && (
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                            <div
                                className="bg-indigo-500 h-2 rounded-full"
                                style={{ width: `${uploadProgress}%` }}
                            ></div>
                        </div>
                    )}
                </div>

                <button
                    type="submit"
                    disabled={isSubmitting || isUploading}
                    className="w-full bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400"
                >
                    {isSubmitting
                        ? "Submitting..."
                        : formData.id
                            ? "Update Teacher"
                            : "Submit"}
                </button>
            </form>

            {showCamera && (
                <CameraCapture
                    setPhoto={handleCameraCapture}
                    onClose={() => setShowCamera(false)}
                    initialFacingMode="user"
                />
            )}

            {/* ---------------- TABLE ---------------- */}
            <div className="bg-white shadow-lg rounded-2xl p-6 w-full max-w-full lg:max-w-4xl">
                <h2 className="text-2xl font-bold text-center mb-4">
                    Registered Teachers ({filteredTeachers.length} {searchTerm.trim() ? "found" : "total"})
                </h2>

                <div className="mb-6">
                    <input
                        type="text"
                        placeholder="Search by Teacher Name or ID"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    ID
                                </th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Name
                                </th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">
                                    Gender
                                </th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">
                                    Phone
                                </th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">
                                    Reg. Date
                                </th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Photo
                                </th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredTeachers.map((teacher) => (
                                <tr key={teacher.id}>
                                    <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {teacher.teacherID}
                                    </td>
                                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {teacher.teacherName}
                                    </td>
                                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 hidden md:table-cell">
                                        {teacher.gender}
                                    </td>
                                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 hidden md:table-cell">
                                        {teacher.phone}
                                    </td>
                                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 hidden md:table-cell">
                                        {teacher.registrationDate}
                                    </td>
                                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {teacher.userPhotoUrl && (
                                            <img
                                                src={teacher.userPhotoUrl}
                                                alt={teacher.teacherName}
                                                className="h-10 w-10 rounded-full object-cover"
                                            />
                                        )}
                                    </td>
                                    <td className="px-3 py-4 whitespace-nowrap text-sm font-medium">
                                        <button
                                            onClick={() => handleUpdate(teacher)}
                                            className="text-indigo-600 hover:text-indigo-900 mr-2"
                                        >
                                            Update
                                        </button>
                                        <button
                                            onClick={() =>
                                                handleDelete(teacher.id, teacher.teacherName)
                                            }
                                            className="text-red-600 hover:text-red-900"
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filteredTeachers.length === 0 && (
                                <tr>
                                    <td
                                        colSpan="7"
                                        className="px-6 py-4 text-center text-sm text-gray-500"
                                    >
                                        No teachers found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default TeacherRegistration;