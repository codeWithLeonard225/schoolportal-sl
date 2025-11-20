import React, { useEffect, useState, useMemo } from "react";
import { db } from "../../../firebase";
import { collection, query, onSnapshot } from "firebase/firestore";
import { toast } from "react-toastify";
import { 
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';

// --- Recharts Color Palette ---
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

// Utility Hook to process the raw student data into report data
const useDashboardData = (users) => {
    return useMemo(() => {
        if (!users.length) {
            return {
                totalStudents: 0,
                genderData: [],
                classData: [],
                academicYearReports: {},
            };
        }

        const totalStudents = users.length;
        const academicYearReports = {};

        users.forEach(user => {
            const year = user.academicYear || 'N/A';
            const studentClass = user.class || 'N/A';
            const gender = user.gender || 'Other';

            if (!academicYearReports[year]) {
                academicYearReports[year] = {
                    total: 0,
                    gender: { Male: 0, Female: 0, Other: 0 },
                    classes: {},
                };
            }

            // Aggregate by Academic Year
            academicYearReports[year].total += 1;
            academicYearReports[year].gender[gender] += 1;
            academicYearReports[year].classes[studentClass] = 
                (academicYearReports[year].classes[studentClass] || 0) + 1;
        });

        // Calculate overall Gender Data (for a Pie Chart)
        const overallGender = users.reduce((acc, user) => {
            const gender = user.gender || 'Other';
            acc[gender] = (acc[gender] || 0) + 1;
            return acc;
        }, {});
        const genderData = Object.keys(overallGender).map(key => ({
            name: key,
            value: overallGender[key],
        }));

        // Calculate overall Class Data (for a Bar Chart)
        const overallClasses = users.reduce((acc, user) => {
            const studentClass = user.class || 'N/A';
            acc[studentClass] = (acc[studentClass] || 0) + 1;
            return acc;
        }, {});
        const classData = Object.keys(overallClasses).map(key => ({
            class: key,
            count: overallClasses[key],
        }));


        return {
            totalStudents,
            genderData,
            classData,
            academicYearReports,
        };
    }, [users]);
};

// Component to display a simple stat card
const StatCard = ({ title, value, color }) => (
    <div className={`p-4 rounded-lg shadow-lg ${color} text-white`}>
        <h3 className="text-sm font-medium opacity-80">{title}</h3>
        <p className="text-3xl font-bold">{value}</p>
    </div>
);

const Dashboard1 = () => {
    const [users, setUsers] = useState([]);
    const { totalStudents, genderData, classData, academicYearReports } = useDashboardData(users);
    const [selectedYear, setSelectedYear] = useState('All');

    // 🛑 REAL-TIME LISTENER (Duplicated from Registration.jsx for simplicity)
    useEffect(() => {
        const collectionRef = collection(db, "Voters");
        const q = query(collectionRef); 

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const usersList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            }));
            setUsers(usersList);
        }, (error) => {
            console.error("Firestore onSnapshot failed:", error);
            toast.error("Failed to stream real-time data.");
        });

        return () => unsubscribe();
    }, []);

    // Determine the data to display based on the selected academic year
    const displayData = selectedYear === 'All' 
        ? classData 
        : Object.keys(academicYearReports[selectedYear]?.classes || {}).map(className => ({
            class: className,
            count: academicYearReports[selectedYear].classes[className],
        }));

    const years = ['All', ...Object.keys(academicYearReports).sort()];

    return (
        <div className="min-h-screen bg-gray-100 p-6 space-y-6">
            <h1 className="text-3xl font-bold text-center text-gray-800">Student Enrollment Dashboard 📊</h1>
            
            {/* ---------------------------------- */}
            {/* --- 1. OVERALL STATISTICS (CARDS) --- */}
            {/* ---------------------------------- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard title="Total Students" value={totalStudents} color="bg-indigo-600" />
                <StatCard 
                    title="Total Academic Years" 
                    value={Object.keys(academicYearReports).length} 
                    color="bg-purple-600" 
                />
                <StatCard 
                    title="Avg. Students per Class" 
                    value={totalStudents > 0 ? (totalStudents / classData.length).toFixed(1) : 0} 
                    color="bg-green-600" 
                />
            </div>

            {/* --- ACADEMIC YEAR FILTER --- */}
            <div className="flex justify-start items-center space-x-4">
                <label className="font-semibold text-gray-700">Filter by Academic Year:</label>
                <select 
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="p-2 border rounded-lg shadow-sm"
                >
                    {years.map(year => (
                        <option key={year} value={year}>{year}</option>
                    ))}
                </select>
            </div>
            
            <hr />

            {/* ---------------------------------- */}
            {/* --- 2. CHARTS (Class & Gender) --- */}
            {/* ---------------------------------- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-white p-6 rounded-2xl shadow-lg">
                
                {/* --- A. Students per Class (Bar Chart) --- */}
                <div>
                    <h2 className="text-xl font-semibold text-center mb-4">
                        Students Per Class ({selectedYear})
                    </h2>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={displayData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ccc" />
                            <XAxis dataKey="class" tick={{ fontSize: 10 }} />
                            <YAxis allowDecimals={false} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="count" fill="#8884d8" name="Student Count" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                
                {/* --- B. Gender Distribution (Pie Chart - Always Overall) --- */}
                <div>
                    <h2 className="text-xl font-semibold text-center mb-4">Overall Gender Distribution</h2>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={genderData}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                outerRadius={100}
                                fill="#8884d8"
                                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                            >
                                {genderData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* -------------------------------------- */}
            {/* --- 3. DETAILED BREAKDOWN BY YEAR --- */}
            {/* -------------------------------------- */}
            <hr />
            <h2 className="text-2xl font-bold text-gray-800 mt-6">Detailed Academic Year Reports</h2>
            <div className="space-y-4">
                {Object.keys(academicYearReports).sort().map(year => (
                    <div key={year} className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
                        <h3 className="text-xl font-semibold mb-2 text-blue-700">Academic Year: {year}</h3>
                        <p className="font-medium">Total Students: <span className="text-lg font-bold">{academicYearReports[year].total}</span></p>
                        
                        <div className="grid grid-cols-3 gap-2 text-sm mt-2">
                            <p className="text-blue-500">Male: {academicYearReports[year].gender.Male}</p>
                            <p className="text-pink-500">Female: {academicYearReports[year].gender.Female}</p>
                            <p className="text-gray-500">Other: {academicYearReports[year].gender.Other}</p>
                        </div>

                        <h4 className="font-medium mt-3 border-t pt-2">Class Breakdown:</h4>
                        <ul className="list-disc list-inside text-sm ml-2 grid grid-cols-2">
                            {Object.entries(academicYearReports[year].classes).sort().map(([className, count]) => (
                                <li key={className} className="text-gray-600">{className}: <span className="font-bold">{count}</span></li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>

        </div>
    );
};

export default Dashboard1;