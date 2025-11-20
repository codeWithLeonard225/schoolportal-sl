import React, { useEffect, useState, useMemo } from "react";
import { db } from "../../../firebase";
import { collection, query, onSnapshot } from "firebase/firestore";
import {
  PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line
} from "recharts";

const COLORS = ['#0088FE', '#FF8042', '#00C49F'];

const Dashboard2 = () => {
  const [users, setUsers] = useState([]);

  // Firestore real-time listener
  useEffect(() => {
    const q = query(collection(db, "Voters"));
    const unsubscribe = onSnapshot(q, snapshot => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(data);
    });

    return () => unsubscribe();
  }, []);

  // Prepare dashboard data
  const dashboardData = useMemo(() => {
    const totalStudents = users.length;

    const studentsPerClass = {};
    const genderCount = { Male: 0, Female: 0, Other: 0 };
    const studentsPerYear = {};

    users.forEach(student => {
      // Class
      const cls = student.class || "Unknown";
      studentsPerClass[cls] = (studentsPerClass[cls] || 0) + 1;

      // Gender
      if (student.gender) genderCount[student.gender] = (genderCount[student.gender] || 0) + 1;

      // Academic Year
      const year = student.academicYear || "Unknown";
      studentsPerYear[year] = (studentsPerYear[year] || 0) + 1;
    });

    return { totalStudents, studentsPerClass, genderCount, studentsPerYear };
  }, [users]);

  // Transform data for charts
  const genderData = Object.entries(dashboardData.genderCount).map(([name, value]) => ({ name, value }));
  const classData = Object.entries(dashboardData.studentsPerClass).map(([className, count]) => ({ className, count }));
  const yearData = Object.entries(dashboardData.studentsPerYear).map(([year, count]) => ({ year, count }));

  return (
    <div className="p-6 space-y-6">
      {/* Total Students */}
      <div className="bg-white shadow rounded p-4 text-center">
        <h3 className="text-lg font-bold">Total Students</h3>
        <p className="text-3xl font-semibold">{dashboardData.totalStudents}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Pie Chart: Gender */}
        <div className="bg-white shadow rounded p-4 flex justify-center">
          <PieChart width={300} height={300}>
            <Pie
              data={genderData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={100}
              label
            >
              {genderData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </div>

        {/* Bar Chart: Students per Class */}
        <div className="bg-white shadow rounded p-4 flex justify-center">
          <BarChart width={400} height={300} data={classData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="className" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="count" fill="#8884d8" />
          </BarChart>
        </div>

        {/* Line Chart: Students per Academic Year */}
        <div className="bg-white shadow rounded p-4 flex justify-center">
          <LineChart width={400} height={300} data={yearData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="year" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="count" stroke="#82ca9d" />
          </LineChart>
        </div>
      </div>
    </div>
  );
};

export default Dashboard2;
