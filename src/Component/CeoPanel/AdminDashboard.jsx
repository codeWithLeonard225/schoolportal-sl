import React, { useState, useEffect, useMemo } from "react";
import { collection, getDocs, query } from "firebase/firestore";
import { db } from "../../../firebase";
import { FaSchool, FaUsers, FaMale, FaFemale, FaChartLine, FaFilter, FaRedo } from 'react-icons/fa';
import localforage from "localforage";
import { toast } from "react-toastify"; // Added toast for feedback

// 💾 Initialize localforage stores (using the setup you provided)
const pupilStore = localforage.createInstance({
    name: "PupilDataCache",
    storeName: "pupil_reg",
});
const PUPIL_CACHE_KEY = 'all_pupils_data';


const AdminDashboard = () => {
    const [totalSchools, setTotalSchools] = useState(0);
    const [totalAdmins, setTotalAdmins] = useState(0);
    const [totalSchoolAccesses, setTotalSchoolAccesses] = useState(0);
    
    // EXISTING PUPIL STATES
    const [allPupils, setAllPupils] = useState([]);
    const [generalPupilStats, setGeneralPupilStats] = useState({ total: 0, male: 0, female: 0 });
    const [schoolNameMap, setSchoolNameMap] = useState({});
    
    // FILTER STATES
    const [selectedSchoolId, setSelectedSchoolId] = useState('all');
    const [selectedGender, setSelectedGender] = useState('all');
    
    // Updated loading state management
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false); // New state for network fetch status

    // --- 1. Data Aggregation (Memoized) ---
    const schoolPupilBreakdown = useMemo(() => {
        // ... (aggregation logic remains the same) ...
        const bySchool = {};
        let generalMale = 0;
        let generalFemale = 0;

        allPupils.forEach(pupil => {
            if (pupil.schoolId && pupil.gender) {
                const schoolId = pupil.schoolId;
                const gender = pupil.gender.toLowerCase();

                if (!bySchool[schoolId]) {
                    bySchool[schoolId] = { total: 0, male: 0, female: 0 };
                }

                bySchool[schoolId].total++;

                if (gender === 'male') {
                    generalMale++;
                    bySchool[schoolId].male++;
                } else if (gender === 'female') {
                    generalFemale++;
                    bySchool[schoolId].female++;
                }
            }
        });
        
        setGeneralPupilStats({
            total: allPupils.length,
            male: generalMale,
            female: generalFemale,
        });

        return bySchool;
    }, [allPupils]);


    // --- 2. Data Fetching and Caching Logic ---
    const fetchPupilDataFromNetwork = async () => {
        try {
            const pupilsSnap = await getDocs(query(collection(db, "PupilsReg")));
            const pupilList = pupilsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // 4. Update Cache
            await pupilStore.setItem(PUPIL_CACHE_KEY, pupilList);
            return pupilList;
        } catch (error) {
            console.error("Error fetching pupil data from network:", error);
            toast.error("Failed to refresh pupil data from the server.");
            return null;
        }
    };
    
    const fetchDashboardData = async (forceRefresh = false) => {
        // Only show full loading screen on initial load or if forcing refresh
        if (!forceRefresh) {
            setLoading(true);
        } else {
             setIsRefreshing(true);
        }

        try {
            // --- A. School and Admin Data (Network Only) ---
            // These collections are smaller/less critical for immediate display, keeping them network-only for simplicity.
            const [schoolsSnap, adminsSnap, accessSnap] = await Promise.all([
                getDocs(query(collection(db, "Schools"))),
                getDocs(query(collection(db, "Admins"))),
                getDocs(query(collection(db, "SchoolAccess"))),
            ]);

            const schoolsList = schoolsSnap.docs.map(doc => doc.data());
            const nameMap = {};
            schoolsList.forEach(school => {
                if (school.schoolID) {
                    nameMap[school.schoolID] = school.schoolName;
                }
            });
            setSchoolNameMap(nameMap);
            setTotalSchools(schoolsSnap.size);
            setTotalAdmins(adminsSnap.size);
            setTotalSchoolAccesses(accessSnap.size);
            
            
            // --- B. Pupil Data (Cache First) ---
            let cachedPupils = null;
            
            if (!forceRefresh) {
                // 1. Check Cache First
                cachedPupils = await pupilStore.getItem(PUPIL_CACHE_KEY);
            }

            if (cachedPupils && cachedPupils.length > 0) {
                // 2. Data found in cache: Display immediately, then fetch new data silently
                setAllPupils(cachedPupils);
                if (!forceRefresh) {
                    setLoading(false); // Stop initial loading spinner immediately
                }
                
                toast.info(`Displaying cached data (${cachedPupils.length} pupils). Checking for updates...`, { autoClose: 3000 });
            } 
            
            // 3. Fetch from Network (Always fetch to ensure fresh data and update cache)
            const networkPupils = await fetchPupilDataFromNetwork();

            if (networkPupils && networkPupils.length > 0) {
                // Only update if network data is newer/different (simple length check or a deeper comparison could be done)
                // For simplicity, we assume network data is always the final source of truth.
                if (JSON.stringify(networkPupils) !== JSON.stringify(cachedPupils)) {
                    setAllPupils(networkPupils);
                    if (!forceRefresh) {
                       toast.success(`Updated with fresh data (${networkPupils.length} pupils) from server.`);
                    }
                }
            } else if (!cachedPupils) {
                // If neither cache nor network had data
                setAllPupils([]);
            }
            
        } catch (error) {
            console.error("Error in dashboard setup:", error);
            // Show error toast if the initial setup fails entirely
            if (!cachedPupils) {
                toast.error("Initial data load failed. Check your network connection.");
            }
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const handleRefresh = () => {
        fetchDashboardData(true); // Force network fetch
    };

    // Helper component for KPI cards (same as before)
    const StatCard = ({ title, value, icon, color, elementIcon }) => (
        <div className={`bg-white p-6 rounded-xl shadow-lg border-b-4 ${color}`}>
            <div className="flex items-center">
                <div className={`p-3 rounded-full ${icon.bg} ${icon.text} mr-4`}>
                    {elementIcon || icon.element}
                </div>
                <div>
                    <p className="text-sm font-medium text-gray-500">{title}</p>
                    {loading ? (
                         <div className="h-6 w-16 bg-gray-200 animate-pulse mt-1 rounded"></div>
                    ) : (
                        <p className="text-3xl font-bold text-gray-900">{value}</p>
                    )}
                </div>
            </div>
        </div>
    );
    
    const sortedSchoolIds = Object.keys(schoolPupilBreakdown).sort();

    const filteredSchoolStats = useMemo(() => {
        const statsArray = sortedSchoolIds.map(schoolId => ({
            schoolId,
            schoolName: schoolNameMap[schoolId] || 'Unknown School',
            ...schoolPupilBreakdown[schoolId],
        }));

        let filtered = selectedSchoolId === 'all'
            ? statsArray
            : statsArray.filter(stat => stat.schoolId === selectedSchoolId);
        
        return filtered;
    }, [schoolPupilBreakdown, selectedSchoolId, sortedSchoolIds, schoolNameMap]);


    return (
        <div className="p-8 bg-gray-100 min-h-screen">
            <h1 className="text-4xl font-extrabold text-gray-800 mb-8 flex items-center justify-between">
                <span>🚀 Super Admin Dashboard</span>
                <button 
                    onClick={handleRefresh} 
                    disabled={isRefreshing}
                    className={`p-3 rounded-full text-white transition-colors duration-300 ${isRefreshing ? 'bg-gray-500 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}`}
                    title="Force Refresh Data"
                >
                    <FaRedo className={isRefreshing ? 'animate-spin' : ''} />
                </button>
            </h1>
            
            {/* --- Key Performance Indicators (KPIs) - Rows 1 & 2 --- */}
            {/* ... (StatCard sections remain the same) ... */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <StatCard title="Total Registered Schools" value={totalSchools} color="border-indigo-500" icon={{ element: '🏫', bg: 'bg-indigo-100', text: 'text-indigo-600' }} />
                <StatCard title="Total Admins" value={totalAdmins} color="border-green-500" icon={{ element: '🧑‍💻', bg: 'bg-green-100', text: 'text-green-600' }} />
                <StatCard title="Access Control Records" value={totalSchoolAccesses} color="border-yellow-500" icon={{ element: '🔑', bg: 'bg-yellow-100', text: 'text-yellow-600' }} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                <StatCard title="Total Pupils (General)" value={generalPupilStats.total} color="border-purple-500" elementIcon={<FaUsers />} icon={{ bg: 'bg-purple-100', text: 'text-purple-600' }} />
                <StatCard title="Total Male Pupils" value={generalPupilStats.male} color="border-blue-500" elementIcon={<FaMale />} icon={{ bg: 'bg-blue-100', text: 'text-blue-600' }} />
                <StatCard title="Total Female Pupils" value={generalPupilStats.female} color="border-pink-500" elementIcon={<FaFemale />} icon={{ bg: 'bg-pink-100', text: 'text-pink-600' }} />
            </div>


            <hr className="my-8"/>

            {/* --- Breakdown by School Table (With Filters) --- */}
            <div className="bg-white shadow-2xl rounded-xl p-6 mb-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
                    <FaChartLine className="mr-3 text-red-500"/> Pupil Enrollment Breakdown
                </h2>
                
                {/* FILTERS ROW */}
                <div className="flex flex-col sm:flex-row gap-4 mb-6 p-4 bg-gray-50 rounded-lg border">
                    <div className="flex items-center gap-2 flex-1">
                        <FaFilter className="text-gray-500"/>
                        <label htmlFor="schoolFilter" className="font-medium text-sm text-gray-700">Filter by School:</label>
                        <select
                            id="schoolFilter"
                            value={selectedSchoolId}
                            onChange={(e) => setSelectedSchoolId(e.target.value)}
                            className="p-2 border rounded-lg flex-1 min-w-[150px]"
                        >
                            <option value="all">All Schools</option>
                            {sortedSchoolIds.map(id => (
                                <option key={id} value={id}>{schoolNameMap[id] || id}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-2 flex-1">
                        <label htmlFor="genderFilter" className="font-medium text-sm text-gray-700">Highlight Gender:</label>
                        <select
                            id="genderFilter"
                            value={selectedGender}
                            onChange={(e) => setSelectedGender(e.target.value)}
                            className="p-2 border rounded-lg flex-1 min-w-[150px]"
                        >
                            <option value="all">All Genders</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                        </select>
                    </div>
                </div>

                {loading && allPupils.length === 0 ? (
                    <div className="text-center p-4 text-gray-500">Loading initial data...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">School Name (ID)</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Pupils</th>
                                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${selectedGender === 'male' ? 'bg-blue-200 text-blue-800' : 'text-gray-500'}`}>Male</th>
                                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${selectedGender === 'female' ? 'bg-pink-200 text-pink-800' : 'text-gray-500'}`}>Female</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredSchoolStats.map(stats => (
                                    <tr key={stats.schoolId} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-indigo-600">
                                            {stats.schoolName} ({stats.schoolId})
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-bold">{stats.total}</td>
                                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${selectedGender === 'male' ? 'bg-blue-100 font-semibold' : 'text-blue-600'}`}>{stats.male}</td>
                                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${selectedGender === 'female' ? 'bg-pink-100 font-semibold' : 'text-pink-600'}`}>{stats.female}</td>
                                    </tr>
                                ))}
                                {filteredSchoolStats.length === 0 && (
                                    <tr>
                                        <td colSpan="4" className="text-center py-4 text-gray-500">
                                            No pupil records found for the selected filter(s).
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* --- Overview Section --- */}
            <div className="bg-white shadow-2xl rounded-xl p-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Management Overviews</h2>
                
                <div className="mb-8">
                    <h3 className="text-xl font-semibold text-indigo-700 mb-4 border-b pb-2">Recent School Registrations</h3>
                    <p className="text-gray-500">*The full table view is available in the dedicated School Registration component.*</p>
                </div>

                <div>
                    <h3 className="text-xl font-semibold text-green-700 mb-4 border-b pb-2">Admin Accounts Overview</h3>
                    <p className="text-gray-500">*The full form and list management is available in the dedicated Admin Management component.*</p>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;