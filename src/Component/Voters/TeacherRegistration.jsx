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



    const [positions, setPositions] = useState([]);
    const [showPositionModal, setShowPositionModal] = useState(false);
    const [newPosition, setNewPosition] = useState("");

    const [formData, setFormData] = useState({
        id: null,
        teacherID: uuidv4().slice(0, 8),
        teacherName: "",
        gender: "",
        phone: "",
        email: "",
        address: "",
        position: "",
        salary: "",
        academicStartDate: new Date().toISOString().slice(0, 10),
        lateCostPerDay: "",
        absentCostPerDay: "",
        registrationDate: new Date().toISOString().slice(0, 10),
        registeredBy: "",
        userPhoto: null,
        userPublicId: null,
        schoolId: schoolId,

        // ✅ NEW
        isFormTeacher: false,
        assignClass: "",
    });

    const [searchTerm, setSearchTerm] = useState("");
    const [showCamera, setShowCamera] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [teachers, setTeachers] = useState([]);
    const [loading, setLoading] = useState(true); // ⬅️ Added loading state
    const [classes, setClasses] = useState([]);


    // Load positions for this school
    useEffect(() => {
        if (!schoolId || schoolId === "N/A") {
            setPositions([]);
            return;
        }

        const positionsRef = collection(db, "SchoolPositions");

        const q = query(
            positionsRef,
            where("schoolId", "==", schoolId)
        );

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const schoolPositions = snapshot.docs.map((positionDoc) => ({
                    id: positionDoc.id,
                    ...positionDoc.data(),
                }));

                setPositions(schoolPositions);
            },
            (error) => {
                console.error("Error loading school positions:", error);
                toast.error("Failed to load positions.");
            }
        );

        return () => unsubscribe();
    }, [schoolId]);

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


    useEffect(() => {
        if (schoolId === "N/A") return;

        const q = query(
            collection(db, "Classes"),
            where("schoolId", "==", schoolId)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const classList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setClasses(classList);
        });

        return () => unsubscribe();
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
                position: formData.position,
                gender: formData.gender,
                phone: formData.phone,
                email: formData.email,
                address: formData.address,
                registrationDate: formData.registrationDate,
                registeredBy: formData.registeredBy,

                // Salary
                salary: formData.salary ? Number(formData.salary) : null,

                // Attendance / Payroll Rules
                academicStartDate: formData.academicStartDate || null,
                lateCostPerDay: formData.lateCostPerDay
                    ? Number(formData.lateCostPerDay)
                    : 0,
                absentCostPerDay: formData.absentCostPerDay
                    ? Number(formData.absentCostPerDay)
                    : 0,

                userPhotoUrl: formData.userPhoto,
                userPublicId: formData.userPublicId,
                schoolId: formData.schoolId,

                isFormTeacher: formData.isFormTeacher,
                assignClass: formData.assignClass || null,
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
                position: "",
                gender: "",
                phone: "",
                email: "",
                address: "",
                registrationDate: new Date().toISOString().slice(0, 10),
                registeredBy: "",
                salary: "",
                academicStartDate: new Date().toISOString().slice(0, 10),
                lateCostPerDay: "",
                absentCostPerDay: "",
                userPhoto: null,
                userPublicId: null,
                schoolId: schoolId,
                // ✅ RESET NEW FIELDS
                isFormTeacher: false,
                assignClass: "",
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
            position: teacher.position || "",
            gender: teacher.gender || "",
            phone: teacher.phone || "",
            email: teacher.email || "",
            address: teacher.address || "",
            registrationDate: teacher.registrationDate,
            registeredBy: teacher.registeredBy,
            salary: teacher.salary ?? "",

            academicStartDate:
                teacher.academicStartDate ||
                new Date().toISOString().slice(0, 10),
            lateCostPerDay: teacher.lateCostPerDay ?? "",
            absentCostPerDay: teacher.absentCostPerDay ?? "",

            userPhoto: teacher.userPhotoUrl,
            userPublicId: teacher.userPublicId,
            schoolId: teacher.schoolId || schoolId,

            // ✅ NEW
            isFormTeacher: teacher.isFormTeacher || false,
            assignClass: teacher.assignClass || "",
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

    const handleAddPosition = async () => {
        const position = newPosition.trim();

        if (!position) {
            toast.error("Please enter a position.");
            return;
        }

        if (!schoolId || schoolId === "N/A") {
            toast.error("School ID is missing.");
            return;
        }

        const exists = positions.some(
            (item) =>
                item.position.toLowerCase() === position.toLowerCase()
        );

        if (exists) {
            toast.error("This position already exists.");
            return;
        }

        try {
            await addDoc(collection(db, "SchoolPositions"), {
                position: position,
                schoolId: schoolId
            });

            setNewPosition("");
            setShowPositionModal(false);

            toast.success("Position added successfully.");
        } catch (error) {
            console.error("Error adding position:", error);
            toast.error("Failed to add position.");
        }
    };

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
                    <div className="flex flex-col md:flex-row md:space-x-4">

                        {/* Teacher Name */}
                        <div className="flex-1">
                            <label className="block mb-2 font-medium text-sm">
                                Teacher Name
                            </label>

                            <input
                                type="text"
                                name="teacherName"
                                value={formData.teacherName}
                                onChange={handleInputChange}
                                className="w-full p-2 mb-4 border rounded-lg"
                                required
                            />
                        </div>

                      
                        {/* Title / Position */}
                        <div className="flex-1">
                            <label className="block mb-2 font-medium text-sm">
                                Title / Position
                            </label>

                            <div className="flex gap-2 mb-4">
                                <select
                                    name="position"
                                    value={formData.position}
                                    onChange={handleInputChange}
                                    className="flex-1 p-2 border rounded-lg"
                                >
                                    <option value="">Select Position</option>

                                    {positions.map((item) => (
                                        <option
                                            key={item.id}
                                            value={item.position}
                                        >
                                            {item.position}
                                        </option>
                                    ))}
                                </select>

                                <button
                                    type="button"
                                    onClick={() => setShowPositionModal(true)}
                                    className="bg-green-600 hover:bg-green-700 text-white px-4 rounded-lg font-semibold"
                                    title="Add Position"
                                >
                                    +
                                </button>
                            </div>
                        </div>

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

                <div className="mb-4">
                    <label className="flex items-center space-x-2">
                        <input
                            type="checkbox"
                            checked={formData.isFormTeacher}
                            onChange={(e) =>
                                setFormData(prev => ({
                                    ...prev,
                                    isFormTeacher: e.target.checked,
                                    assignClass: e.target.checked ? prev.assignClass : ""
                                }))
                            }
                        />
                        <span className="font-medium text-sm">Form Teacher</span>
                    </label>
                </div>

                {formData.isFormTeacher && (
                    <div className="mb-4">
                        <label className="block mb-2 font-medium text-sm">
                            Assign Class
                        </label>
                        <select
                            name="assignClass"
                            value={formData.assignClass}
                            onChange={handleInputChange}
                            className="w-full p-2 border rounded-lg"
                            required
                        >
                            <option value="">Select Class</option>
                            {classes.map((cls) => (
                                <option key={cls.id} value={cls.className}>
                                    {cls.className}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Registration Date, Registered By and Salary */}
                <div className="flex flex-col md:flex-row md:space-x-4">

                    {/* Registration Date */}
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

                    {/* Registered By */}
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

                    {/* Salary */}
                    <div className="flex-1">
                        <label className="block mb-2 font-medium text-sm">
                            Salary <span className="text-gray-400">(Optional)</span>
                        </label>

                        <input
                            type="number"
                            name="salary"
                            value={formData.salary}
                            onChange={handleInputChange}
                            className="w-full p-2 mb-4 border rounded-lg"
                            placeholder="Enter salary"
                            min="0"
                        />
                    </div>

                </div>


                {/* ===================================== */}
                {/* SALARY & ATTENDANCE DEDUCTION RULES */}
                {/* ===================================== */}

                <div className="border-t border-gray-200 pt-4 mt-2 mb-4">

                    <h3 className="text-sm font-bold text-gray-700 mb-4">
                        Salary & Attendance Deduction Rules
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                        {/* Academic Start Date */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">
                                Academic Start Date
                            </label>

                            <input
                                type="date"
                                name="academicStartDate"
                                value={formData.academicStartDate}
                                onChange={handleInputChange}
                                className="w-full p-2.5 border rounded-xl text-sm bg-gray-50"
                            />

                            <p className="text-[10px] text-gray-400 mt-1">
                                Attendance deductions will only be calculated from this date.
                            </p>
                        </div>


                        {/* Late Deduction */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">
                                Late Deduction Per Day
                            </label>

                            <input
                                type="number"
                                name="lateCostPerDay"
                                min="0"
                                value={formData.lateCostPerDay}
                                onChange={handleInputChange}
                                placeholder="e.g. 20"
                                className="w-full p-2.5 border rounded-xl text-sm bg-gray-50"
                            />

                            <p className="text-[10px] text-gray-400 mt-1">
                                Amount deducted from salary for each late day.
                            </p>
                        </div>


                        {/* Absent Deduction */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">
                                Absent Deduction Per Day
                            </label>

                            <input
                                type="number"
                                name="absentCostPerDay"
                                min="0"
                                value={formData.absentCostPerDay}
                                onChange={handleInputChange}
                                placeholder="e.g. 50"
                                className="w-full p-2.5 border rounded-xl text-sm bg-gray-50"
                            />

                            <p className="text-[10px] text-gray-400 mt-1">
                                Amount deducted from salary for each absent day.
                            </p>
                        </div>

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
                        folder="SchoolApp/Teachers"
                        onUploadSuccess={handleUploadSuccess}
                        onUploadStart={() => {
                            setIsUploading(true);
                            setUploadProgress(0);
                        }}
                        onUploadProgress={setUploadProgress}
                        onUploadComplete={() => {
                            setIsUploading(false);
                        }}
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

            {showPositionModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md">

                        <h2 className="text-xl font-bold mb-4">
                            Add Position
                        </h2>

                        <input
                            type="text"
                            value={newPosition}
                            onChange={(e) => setNewPosition(e.target.value)}
                            placeholder="Enter position"
                            className="w-full p-3 border rounded-lg mb-4"
                        />

                        <div className="flex justify-end gap-3">

                            <button
                                type="button"
                                onClick={() => {
                                    setShowPositionModal(false);
                                    setNewPosition("");
                                }}
                                className="px-4 py-2 bg-gray-300 rounded-lg"
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                onClick={handleAddPosition}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg"
                            >
                                Add Position
                            </button>

                        </div>
                    </div>
                </div>
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
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Position
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
                                    Form Teacher
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
                                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {teacher.position || "—"}
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
                                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {teacher.isFormTeacher ? (
                                            <span className="text-green-600 font-semibold">
                                                {teacher.assignClass}
                                            </span>
                                        ) : (
                                            <span className="text-gray-400">No</span>
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
                                        colSpan="8"
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