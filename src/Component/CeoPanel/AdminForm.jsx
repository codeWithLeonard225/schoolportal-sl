import React, { useState, useEffect } from "react";
import {
    collection,
    addDoc,
    getDocs,
    query,
    where,
    doc,
    updateDoc,
    deleteDoc,
    // 1. ADD setDoc IMPORT
    setDoc,
} from "firebase/firestore";
import { db } from "../../../firebase";
import { pupilLoginFetch } from "../Database/PupilLogin";

// Define a simple password for demonstration. Replace with proper authentication in production.
const ADMIN_PASSWORD = "superadmin";

// Define the available access types for the new form
const ACCESS_TYPES = [
   
    "DEVELOPER",
    "Private",
    "PrivateSpecial",
    "Fees",
    "Special",
    "PupilAttendance"
];

const AdminForm = () => {
    // --- 1. ADMIN FORM STATES ---
    const [adminID, setAdminID] = useState("");
    const [adminName, setAdminName] = useState("");
    const [schoolId, setSchoolId] = useState("");
    const [adminType, setAdminType] = useState("");
    const [editingId, setEditingId] = useState(null);
    const [admins, setAdmins] = useState([]);
     const [role, setRole] = useState(""); // Role state remains a string

    // --- 2. SCHOOL ACCESS FORM STATES (NEW - MODIFIED) ---
    const [accessSchoolId, setAccessSchoolId] = useState("");
    // ⬇️ CHANGED: State is now an array to hold multiple selections
    const [accessType, setAccessType] = useState([]);
    const [accesses, setAccesses] = useState([]);
    const [editingAccessId, setEditingAccessId] = useState(null);

    // --- 3. COMMON UI/HELPER STATES ---
    const [loading, setLoading] = useState(false);
    const [loadingAccess, setLoadingAccess] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Helper to reset the main Admin form fields
    const resetForm = () => {
        setAdminID("");
        setAdminName("");
        setSchoolId("");
        setAdminType("");
        setEditingId(null);
           setRole(""); // Reset role to empty string
    };

    // Helper to reset the School Access form fields (MODIFIED)
    const resetAccessForm = () => {
        setAccessSchoolId("");
        // ⬇️ CHANGED: Reset to empty array
        setAccessType([]);
        setEditingAccessId(null);
    };

    // =================================================================
    //               ADMINS MANAGEMENT LOGIC (UPDATED)
    // =================================================================

    // 1. Fetch existing admins
    const fetchAdmins = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, "Admins"));
            const snapshot = await getDocs(q);
            const data = snapshot.docs
                .map((d) => ({ id: d.id, ...d.data() }))
                .sort((a, b) => (a.adminName || "").localeCompare(b.adminName || ""));
            setAdmins(data);
        } catch (error) {
            console.error("Error fetching admins:", error);
        } finally {
            setLoading(false);
        }
    };

    // 2. Handle Form Submission (Add or Update Admin) - UPDATED
 // 2. Handle Form Submission (Add or Update Admin) - CORRECTION APPLIED HERE
// 2. Handle Form Submission (Add or Update Admin) - FIX APPLIED HERE
const handleSubmit = async (e) => {
    e.preventDefault();

    if (!adminID || !adminName || !schoolId || !adminType) {
        alert("Please fill in all fields, including Admin Type.");
        return;
    }

    setIsSubmitting(true);

    const adminData = {
        adminID,
        adminName,
        schoolId,
        adminType,
        role,
    };

    const loginData = {
        adminID: adminData.adminID,
        adminName: adminData.adminName,
        schoolId: adminData.schoolId,
        adminType: adminData.adminType,
        role: adminData.role,
    };

    try {
        if (editingId) {
            // --- 1. UPDATE LOGIC (Use existing editingId for main DB) ---
            
            // 1. Update in main "Admins" collection (using Firestore Document ID: editingId)
            const adminRef = doc(db, "Admins", editingId);
            await updateDoc(adminRef, adminData);

            
            // If the secondary DB MUST use the random Firestore ID, use editingId:
            const loginRef = doc(pupilLoginFetch, "Admins", editingId); // Use the random Firestore ID
            await setDoc(loginRef, loginData, { merge: true });
            
            alert(`Admin ${adminName} updated successfully!`);

        } else {
            // --- 2. NEW ADMIN LOGIC (Generate ID once and use in both) ---
            
            // 1. Check for existing ID (This check uses the 'adminID' field, which is good)
            const q = query(collection(db, "Admins"), where("adminID", "==", adminID));
            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
                alert("Admin ID already exists!");
                setIsSubmitting(false);
                return;
            }
            
            // **🔥 FIX: Generate a unique ID (the Document ID) upfront**
            const newAdminRef = doc(collection(db, "Admins")); // Generates a new unique DocumentReference
            const newDocId = newAdminRef.id; // This is the ID you want to use in both databases

            // 1. ADD to main "Admins" collection using the generated Document ID
            await setDoc(newAdminRef, adminData); // Use setDoc to manually set the document and its ID

            // 2. Set (Create) in secondary "Admins" collection using the SAME new Document ID
            const loginRef = doc(pupilLoginFetch, "Admins", newDocId); // Use newDocId as the Document ID
            await setDoc(loginRef, loginData); 

            alert(`Admin ${adminName} added successfully! (Doc ID: ${newDocId})`);
        }

        await fetchAdmins();
        resetForm();

    } catch (error) {
        console.error(`Error ${editingId ? "updating" : "adding"} admin:`, error);
        alert(`Failed to ${editingId ? "update" : "add"} admin. Check console.`);
    } finally {
        setIsSubmitting(false);
    }
};

// ... (rest of the component code, including handleAccessSubmit which is separate)

    // 3. Function to load data into the form for editing
    const handleEdit = (admin) => {
        setEditingId(admin.id);
        setAdminID(admin.adminID);
        setAdminName(admin.adminName);
        setSchoolId(admin.schoolId);
        setAdminType(admin.adminType);
           setRole(admin.role || ""); // Load existing role string
    };

    // 4. Function to delete an admin record - UPDATED
    const handleDelete = async (id, name, adminID) => {
        const password = window.prompt(`Enter the password to delete admin: ${name}`);

        if (password === ADMIN_PASSWORD) {
            if (window.confirm(`Are you sure you want to delete admin: ${name}? This cannot be undone.`)) {
                try {
                    // 1. Delete from main "Admins" collection (using Firestore ID)
                    const adminRef = doc(db, "Admins", id);
                    await deleteDoc(adminRef);

                    // 2. Delete from secondary "AdminLogins" collection (using adminID)
                    const loginRef = doc(pupilLoginFetch, "Admins", adminID);
                    await deleteDoc(loginRef);

                    alert(`Admin ${name} deleted successfully from both collections!`);

                    setAdmins(admins.filter(admin => admin.id !== id));

                    if (editingId === id) {
                        resetForm();
                    }
                } catch (error) {
                    console.error("Error deleting admin:", error);
                    alert("Failed to delete admin. Check console for details.");
                }
            }
        } else if (password !== null) {
            alert("Incorrect password. Deletion cancelled.");
        }
    };

    // =================================================================
    //           SCHOOL ACCESS MANAGEMENT LOGIC (UNMODIFIED)
    // =================================================================

    // 5. Fetch existing school access settings (The `accessType` will be an array when fetched)
    const fetchAccesses = async () => {
        setLoadingAccess(true);
        try {
            const q = query(collection(db, "SchoolAccess"));
            const snapshot = await getDocs(q);
            const data = snapshot.docs
                .map((d) => ({
                    id: d.id,
                    ...d.data(),
                    // Ensure accessType is an array, even if Firestore stored it as a single string initially
                    accessType: Array.isArray(d.data().accessType) ? d.data().accessType : (d.data().accessType ? [d.data().accessType] : [])
                }))
                .sort((a, b) => (a.accessSchoolId || "").localeCompare(b.accessSchoolId || ""));
            setAccesses(data);
        } catch (error) {
            console.error("Error fetching school accesses:", error);
        } finally {
            setLoadingAccess(false);
        }
    };

    // 6. Handle Checkbox Change (NEW)
    const handleCheckboxChange = (e) => {
        const { value, checked } = e.target;
        setAccessType(prevAccessType =>
            checked
                // If checked, add the value to the array if it's not already there
                ? [...prevAccessType, value]
                // If unchecked, filter the value out of the array
                : prevAccessType.filter(type => type !== value)
        );
    };

    // 7. Handle School Access Form Submission (MODIFIED)
    const handleAccessSubmit = async (e) => {
        e.preventDefault();

        // ⬇️ CHANGED: Check array length instead of truthiness
        if (!accessSchoolId || accessType.length === 0) {
            alert("Please enter a School ID and select at least one Access Type.");
            return;
        }

        setIsSubmitting(true);
        const accessData = {
            schoolId: accessSchoolId,
            // ⬇️ CHANGED: accessType is inherently an array now
            accessType: accessType,
        };

        try {
            if (editingAccessId) {
                // UPDATE Logic
                const accessRef = doc(db, "SchoolAccess", editingAccessId);
                await updateDoc(accessRef, accessData);
                alert(`Access for School ID ${accessSchoolId} updated successfully!`);
            } else {
                // Check for existing School ID only on NEW registration
                const q = query(collection(db, "SchoolAccess"), where("schoolId", "==", accessSchoolId));
                const snapshot = await getDocs(q);

                if (!snapshot.empty) {
                    alert(`School ID ${accessSchoolId} already has an access setting. Use Update instead.`);
                    setIsSubmitting(false);
                    return;
                }

                // ADD Logic
                await addDoc(collection(db, "SchoolAccess"), accessData);
                alert(`Access for School ID ${accessSchoolId} added successfully!`);
            }

            await fetchAccesses();
            resetAccessForm();

        } catch (error) {
            console.error(`Error ${editingAccessId ? "updating" : "adding"} school access:`, error);
            alert(`Failed to ${editingAccessId ? "update" : "add"} school access. Check console.`);
        } finally {
            setIsSubmitting(false);
        }
    };

    // 8. Function to load access data into the form for editing (MODIFIED)
    const handleAccessEdit = (access) => {
        setEditingAccessId(access.id);
        setAccessSchoolId(access.schoolId);
        // ⬇️ CHANGED: Ensure the state is set to the array from the document
        setAccessType(access.accessType || []);
    };

    // 9. Function to delete a school access record (UNMODIFIED)
    const handleAccessDelete = async (id, schoolId) => {
        const password = window.prompt(`Enter the password to delete access for School ID: ${schoolId}`);

        if (password === ADMIN_PASSWORD) {
            if (window.confirm(`Are you sure you want to delete access for School ID: ${schoolId}? This cannot be undone.`)) {
                try {
                    const accessRef = doc(db, "SchoolAccess", id);
                    await deleteDoc(accessRef);
                    alert(`Access for School ID ${schoolId} deleted successfully!`);

                    setAccesses(accesses.filter(access => access.id !== id));

                    if (editingAccessId === id) {
                        resetAccessForm();
                    }
                } catch (error) {
                    console.error("Error deleting school access:", error);
                    alert("Failed to delete school access. Check console for details.");
                }
            }
        } else if (password !== null) {
            alert("Incorrect password. Deletion cancelled.");
        }
    };

    // 10. Initial data fetching on component mount (UNMODIFIED)
    useEffect(() => {
        fetchAdmins();
        fetchAccesses();
    }, []);

    // =================================================================
    //                              RENDER
    // =================================================================

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-12">

            {/* ----------------------------------------------------------- */}
            {/* ADMIN FORM SECTION */}
            {/* ----------------------------------------------------------- */}
            <div className="max-w-xl mx-auto p-6 bg-gray-50 shadow-2xl rounded-xl">
                <h2 className="text-3xl font-extrabold mb-6 text-center text-indigo-700">
                    {editingId ? "Update Admin Details" : "Add New Admin"}
                </h2>

                <form onSubmit={handleSubmit} className="space-y-4 mb-8 p-6 bg-white rounded-lg shadow-inner">
                    {/* ... Admin Form Fields (Unchanged) ... */}

                    {/* Admin ID Field */}
                    <div>
                        <label className="block font-semibold mb-1 text-gray-700">Admin ID</label>
                        <input
                            type="text"
                            value={adminID}
                            onChange={(e) => setAdminID(e.target.value)}
                            className="w-full border px-4 py-2 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition duration-150"
                            placeholder="Enter unique admin ID"
                            disabled={!!editingId}
                        />
                        {editingId && <p className="text-sm text-red-500 mt-1">Admin ID cannot be changed when updating.</p>}
                    </div>

                    {/* Admin Name Field */}
                    <div>
                        <label className="block font-semibold mb-1 text-gray-700">Admin Name</label>
                        <input
                            type="text"
                            value={adminName}
                            onChange={(e) => setAdminName(e.target.value)}
                            className="w-full border px-4 py-2 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition duration-150"
                            placeholder="Enter admin name"
                        />
                    </div>

                    {/* School ID Field */}
                    <div>
                        <label className="block font-semibold mb-1 text-gray-700">School ID</label>
                        <input
                            type="text"
                            value={schoolId}
                            onChange={(e) => setSchoolId(e.target.value)}
                            className="w-full border px-4 py-2 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition duration-150"
                            placeholder="Enter school ID"
                        />
                    </div>

                    {/* Admin Type Selection Field */}
                    <div>
                        <label className="block font-semibold mb-1 text-gray-700">Admin Type</label>
                        <select
                            value={adminType}
                            onChange={(e) => setAdminType(e.target.value)}
                            className="w-full border px-4 py-2 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition duration-150"
                            required
                        >
                            <option value="" disabled>Select Admin Category</option>
                            <option value="Gov">Government (Gov)</option>
                            <option value="Private">Private</option>
                            <option value="Fees">Fees Admin</option>
                            <option value="Special">Special/Super Admin</option>
                            <option value="PupilAttendance">Pupil Attendance</option>
                             <option value="StaffAttendanceSimple">Staff Attendance</option>
                            <option value="SupervisorOne">Supervisor One</option>
                            <option value="SupervisorTwo">Supervisor Two</option>
                            <option value="SupervisorThree">Supervisor Three</option>
                            <option value="SupervisorFour">Supervisor Four</option>
                            <option value="SupervisorFive">Supervisor Five</option>
                        </select>
                    </div>
                      {/* ✅ UPDATED: Role is now a text input */}
                    <div className="flex-1">
                        <label className="block font-semibold mb-1 text-gray-700">Role</label>
                        <input
                            type="text" // ⬅️ Changed from <select> to <input type="text">
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            className="w-full border px-4 py-2 rounded-lg focus:ring-indigo-500"
                            placeholder="Enter role (e.g., Teacher, CEO)"
                            required
                        />
                    </div>

                    <div className="flex space-x-4">
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-semibold hover:bg-indigo-700 transition disabled:bg-gray-400"
                        >
                            {isSubmitting ? "Processing..." : editingId ? "Save Changes" : "Add Admin"}
                        </button>
                        {editingId && (
                            <button
                                type="button"
                                onClick={resetForm}
                                className="w-1/4 bg-gray-500 text-white py-2 rounded-lg font-semibold hover:bg-gray-600 transition"
                            >
                                Cancel
                            </button>
                        )}
                    </div>
                </form>
            </div>

            <hr className="my-8 border-gray-300 max-w-xl mx-auto" />

            {/* Admins Table (UPDATED to pass adminID to delete) */}
            <div className="max-w-4xl mx-auto">
                <h3 className="text-2xl font-bold mb-4 text-center">Registered Admins ({admins.length})</h3>

                {loading ? (
                    <p className="text-center text-gray-600">Loading admins...</p>
                ) : admins.length > 0 ? (
                    <div className="overflow-x-auto border rounded-lg shadow-md">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-indigo-50">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">School ID</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">School Name</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">AdminType</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {admins.map((admin) => (
                                    <tr key={admin.id} className="hover:bg-indigo-50 transition duration-150">
                                        <td className="px-4 py-3 text-sm text-gray-500">{admin.schoolId}</td>
                                        <td className="px-4 py-3 text-sm text-gray-500">{admin.adminID}</td>
                                        <td className="px-4 py-3 text-sm font-medium text-gray-900 capitalize">{admin.adminName}</td>
                                        <td className="px-4 py-3 text-sm text-gray-700">{admin.schoolName}</td>
                                        <td className="px-4 py-3 text-sm text-indigo-600 font-semibold">{admin.adminType}</td>
                                        <td className="px-4 py-3 text-sm text-gray-700">{admin.role}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                                            <button
                                                onClick={() => handleEdit(admin)}
                                                className="text-indigo-600 hover:text-indigo-800 mr-3 disabled:opacity-50"
                                                disabled={editingId === admin.id}
                                            >
                                                Update
                                            </button>

                                            <button
                                                // Pass the unique adminID for the secondary database deletion
                                                onClick={() => handleDelete(admin.id, admin.adminName, admin.adminID)}
                                                className="text-red-600 hover:text-red-800"
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="text-center text-gray-500">No admins found.</p>
                )}
            </div>

            <hr className="my-12 border-4 border-green-200 rounded-full" />


            {/* ----------------------------------------------------------- */}
            {/* SCHOOL ACCESS FORM SECTION (UNMODIFIED)          */}
            {/* ----------------------------------------------------------- */}
            <div className="max-w-xl mx-auto p-6 bg-green-50 shadow-2xl rounded-xl border-t-4 border-green-600">
                <h2 className="text-3xl font-extrabold mb-6 text-center text-green-700">
                    {editingAccessId ? "Update School Access" : "Configure School Access"}
                </h2>

                {/* School Access Form */}
                <form onSubmit={handleAccessSubmit} className="space-y-4 mb-8 p-6 bg-white rounded-lg shadow-inner">

                    {/* School ID Field */}
                    <div>
                        <label className="block font-semibold mb-1 text-gray-700">School ID</label>
                        <input
                            type="text"
                            value={accessSchoolId}
                            onChange={(e) => setAccessSchoolId(e.target.value)}
                            className="w-full border px-4 py-2 rounded-lg focus:ring-green-500 focus:border-green-500 transition duration-150"
                            placeholder="e.g., 1110, 3230"
                            required
                            // Disable ID input during editing as it's the key field
                            disabled={!!editingAccessId}
                        />
                        {editingAccessId && <p className="text-sm text-red-500 mt-1">School ID cannot be changed when updating access.</p>}
                    </div>

                    {/* Access Type Checkboxes (MODIFIED) */}
                    <div>
                        <label className="block font-semibold mb-2 text-gray-700">Select Access Types (Multiple)</label>
                        <div className="grid grid-cols-2 gap-3 p-3 border rounded-lg bg-gray-50">
                            {ACCESS_TYPES.map((type) => (
                                <label key={type} className="inline-flex items-center">
                                    <input
                                        type="checkbox"
                                        className="form-checkbox text-green-600 h-5 w-5 rounded focus:ring-green-500"
                                        value={type}
                                        checked={accessType.includes(type)} // Check if the type is in the state array
                                        onChange={handleCheckboxChange} // Use the new handler
                                    />
                                    <span className="ml-2 text-sm font-medium text-gray-700">{type}</span>
                                </label>
                            ))}
                        </div>
                        {accessType.length === 0 && (
                            <p className="text-xs text-red-500 mt-1">Please select at least one access type.</p>
                        )}
                    </div>

                    <div className="flex space-x-4">
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 bg-green-600 text-white py-2 rounded-lg font-semibold hover:bg-green-700 transition disabled:bg-gray-400"
                        >
                            {isSubmitting ? "Processing..." : editingAccessId ? "Save Access Changes" : "Add School Access"}
                        </button>
                        {editingAccessId && (
                            <button
                                type="button"
                                onClick={resetAccessForm}
                                className="w-1/4 bg-gray-500 text-white py-2 rounded-lg font-semibold hover:bg-gray-600 transition"
                            >
                                Cancel
                            </button>
                        )}
                    </div>
                </form>
            </div>


            <hr className="my-8 border-gray-300 max-w-xl mx-auto" />

            {/* School Access Table (UNMODIFIED) */}
            <div className="max-w-4xl mx-auto">
                <h3 className="text-2xl font-bold mb-4 text-center">Configured School Accesses ({accesses.length})</h3>

                {loadingAccess ? (
                    <p className="text-center text-gray-600">Loading school accesses...</p>
                ) : accesses.length > 0 ? (
                    <div className="overflow-x-auto border rounded-lg shadow-md">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-green-50">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">School ID</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Access Types</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {accesses.map((access) => (
                                    <tr key={access.id} className="hover:bg-green-50 transition duration-150">
                                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{access.schoolId}</td>
                                        <td className="px-4 py-3 text-sm text-green-600 font-semibold">
                                            {/* ⬇️ CHANGED: Use join(', ') to display the array as a comma-separated string */}
                                            {(access.accessType || []).join(', ')}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                                            <button
                                                onClick={() => handleAccessEdit(access)}
                                                className="text-green-600 hover:text-green-800 mr-3 disabled:opacity-50"
                                                disabled={editingAccessId === access.id}
                                            >
                                                Update
                                            </button>

                                            <button
                                                onClick={() => handleAccessDelete(access.id, access.schoolId)}
                                                className="text-red-600 hover:text-red-800"
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="text-center text-gray-500">No school access configurations found.</p>
                )}
            </div>

        </div>
    );
};

export default AdminForm;