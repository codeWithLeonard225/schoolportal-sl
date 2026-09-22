
import React, {
  useState,
  useEffect,
  useMemo,
} from "react";

import { db } from "../../../../firebase";

import {
  collection,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";

import { useAuth } from "../../Security/AuthContext";

import localforage from "localforage";


// ============================================================
// LOCAL CACHE
// ============================================================

const pupilStore = localforage.createInstance({
  name: "PupilDataCache",
  storeName: "pupil_reg",
});


// ============================================================
// COMPONENT
// ============================================================

const AttendancePageClass = () => {

  const { user } = useAuth();


  // ==========================================================
  // SCHOOL
  // ==========================================================

  const currentSchoolId =
    user?.schoolId || "N/A";


  // ==========================================================
  // TEACHER INFORMATION
  // ==========================================================

  const [liveTeacherInfo, setLiveTeacherInfo] =
    useState(null);


  // ==========================================================
  // CLASS INFORMATION
  // ==========================================================

  const isFormTeacher =
    liveTeacherInfo?.isFormTeacher ??
    user?.data?.isFormTeacher ??
    false;

  const assignedClass =
    liveTeacherInfo?.assignClass ??
    user?.data?.assignClass ??
    null;


  /*
    Same logic as ReportCard:

    Form Teacher + assigned class
    = restricted to that class.
  */

  const isClassRestricted =
    !!(isFormTeacher && assignedClass);


  // ==========================================================
  // STATE
  // ==========================================================

  const [academicYear, setAcademicYear] =
    useState("");

  const [selectedClass, setSelectedClass] =
    useState("");

  const [academicYears, setAcademicYears] =
    useState([]);

  const [availableClasses, setAvailableClasses] =
    useState([]);

  const [allPupilsData, setAllPupilsData] =
    useState([]);

  const [loading, setLoading] =
    useState(true);


  // ==========================================================
  // 1. GET LOGGED-IN TEACHER INFORMATION
  // ==========================================================

  useEffect(() => {

    if (
      !user?.data?.teacherID ||
      !currentSchoolId ||
      currentSchoolId === "N/A"
    ) {
      return;
    }


    const teacherQuery = query(

      collection(db, "Teachers"),

      where(
        "teacherID",
        "==",
        user.data.teacherID
      ),

      where(
        "schoolId",
        "==",
        currentSchoolId
      )

    );


    const unsubscribe = onSnapshot(

      teacherQuery,

      (snapshot) => {

        if (!snapshot.empty) {

          const teacherDoc =
            snapshot.docs[0];

          setLiveTeacherInfo({
            id: teacherDoc.id,
            ...teacherDoc.data(),
          });

        } else {

          setLiveTeacherInfo(null);

        }

      },

      (error) => {

        console.error(
          "Error fetching teacher:",
          error
        );

        setLiveTeacherInfo(null);

      }

    );


    return () => unsubscribe();

  }, [
    user?.data?.teacherID,
    currentSchoolId,
  ]);


  // ==========================================================
  // 2. SET ASSIGNED CLASS
  // ==========================================================

  useEffect(() => {

    if (
      isClassRestricted &&
      assignedClass
    ) {

      setSelectedClass(
        assignedClass
      );

      setAvailableClasses([
        assignedClass,
      ]);

    }

  }, [
    isClassRestricted,
    assignedClass,
  ]);


  // ==========================================================
  // 3. GET PUPILS FROM PUPILSREG
  // ==========================================================

  useEffect(() => {

    if (
      !currentSchoolId ||
      currentSchoolId === "N/A"
    ) {
      return;
    }


    setLoading(true);


    // --------------------------------------------------------
    // CACHE KEY
    // --------------------------------------------------------

    const CACHE_KEY =
      `class_pupils_${currentSchoolId}_${assignedClass || "all"}`;


    // --------------------------------------------------------
    // LOAD CACHE FIRST
    // --------------------------------------------------------

    pupilStore
      .getItem(CACHE_KEY)

      .then((cachedData) => {

        if (
          cachedData?.pupilsList?.length
        ) {

          setAllPupilsData(
            cachedData.pupilsList
          );

          buildFilters(
            cachedData.pupilsList
          );

        }

      })

      .catch((error) => {

        console.error(
          "Cache error:",
          error
        );

      });


    // --------------------------------------------------------
    // FIRESTORE QUERY
    // --------------------------------------------------------

    let pupilsQuery = query(

      collection(
        db,
        "PupilsReg"
      ),

      where(
        "schoolId",
        "==",
        currentSchoolId
      )

    );


    // --------------------------------------------------------
    // IF FORM TEACHER
    // ONLY GET ASSIGNED CLASS
    // --------------------------------------------------------

    if (
      isClassRestricted &&
      assignedClass
    ) {

      pupilsQuery = query(

        pupilsQuery,

        where(
          "class",
          "==",
          assignedClass
        )

      );

    }


    // --------------------------------------------------------
    // LIVE LISTENER
    // --------------------------------------------------------

    const unsubscribe = onSnapshot(

      pupilsQuery,

      async (snapshot) => {

        const pupils =
          snapshot.docs.map(
            (doc) => {

              const data =
                doc.data();

              return {

                id: doc.id,

                studentID:
                  data.studentID,

                studentName:
                  data.studentName,

                class:
                  data.class,

                academicYear:
                  data.academicYear,

                gender:
                  data.gender,

                photoURL:
                  data.photoURL,

              };

            }
          );


        setAllPupilsData(
          pupils
        );


        // ----------------------------------------------------
        // BUILD YEARS AND CLASSES
        // ----------------------------------------------------

        buildFilters(
          pupils
        );


        // ----------------------------------------------------
        // SAVE CACHE
        // ----------------------------------------------------

        await pupilStore.setItem(
          CACHE_KEY,
          {
            pupilsList: pupils,
            timestamp: new Date(),
          }
        );


        setLoading(false);

      },

      (error) => {

        console.error(
          "Error fetching pupils:",
          error
        );

        setLoading(false);

      }

    );


    return () => unsubscribe();


    // eslint-disable-next-line react-hooks/exhaustive-deps

  }, [
    currentSchoolId,
    assignedClass,
    isClassRestricted,
  ]);


  // ==========================================================
  // BUILD ACADEMIC YEARS + CLASSES
  // ==========================================================

  const buildFilters = (
    pupilsList
  ) => {

    let relevantPupils =
      pupilsList;


    // --------------------------------------------------------
    // RESTRICT TO ASSIGNED CLASS
    // --------------------------------------------------------

    if (
      isClassRestricted &&
      assignedClass
    ) {

      relevantPupils =
        pupilsList.filter(
          (pupil) =>
            pupil.class ===
            assignedClass
        );

    }


    // --------------------------------------------------------
    // ACADEMIC YEARS
    // --------------------------------------------------------

    const years = [
      ...new Set(

        relevantPupils
          .map(
            (pupil) =>
              pupil.academicYear
          )
          .filter(Boolean)

      ),
    ].sort().reverse();


    setAcademicYears(
      years
    );


    // --------------------------------------------------------
    // CLASSES
    // --------------------------------------------------------

    let classes;


    if (
      isClassRestricted &&
      assignedClass
    ) {

      classes = [
        assignedClass,
      ];

    } else {

      classes = [
        ...new Set(

          relevantPupils
            .map(
              (pupil) =>
                pupil.class
            )
            .filter(Boolean)

        ),
      ].sort();

    }


    setAvailableClasses(
      classes
    );


    // --------------------------------------------------------
    // AUTOMATIC ACADEMIC YEAR
    // --------------------------------------------------------

    setAcademicYear(
      (previous) =>
        previous ||
        years[0] ||
        ""
    );


    // --------------------------------------------------------
    // AUTOMATIC CLASS
    // --------------------------------------------------------

    if (
      isClassRestricted &&
      assignedClass
    ) {

      setSelectedClass(
        assignedClass
      );

    } else {

      setSelectedClass(
        (previous) =>
          previous ||
          classes[0] ||
          ""
      );

    }

  };


  // ==========================================================
  // 4. FILTER PUPILS
  // ==========================================================

  const filteredPupils = useMemo(() => {

    if (
      !academicYear ||
      !selectedClass
    ) {

      return [];

    }


    return allPupilsData

      .filter(
        (pupil) =>

          pupil.academicYear ===
            academicYear &&

          pupil.class ===
            selectedClass
      )

      .sort(
        (a, b) =>
          (a.studentName || "")
            .localeCompare(
              b.studentName || ""
            )
      );

  }, [
    allPupilsData,
    academicYear,
    selectedClass,
  ]);


  // ==========================================================
  // RENDER
  // ==========================================================

  return (

    <div className="p-4">

      {/* ====================================================
          HEADER
      ===================================================== */}

      <div className="mb-6">

        <h1 className="text-2xl font-bold text-gray-800">
          Class List
        </h1>

        <p className="text-sm text-gray-500">
          View pupils assigned to your class.
        </p>

      </div>


      {/* ====================================================
          TEACHER / CLASS INFO
      ===================================================== */}

      {isFormTeacher &&
        assignedClass && (

          <div className="mb-5 rounded-lg border border-blue-200 bg-blue-50 p-4">

            <div className="text-sm text-blue-800">

              <strong>
                Form Teacher:
              </strong>{" "}

              {liveTeacherInfo?.teacherName ||
                user?.data?.teacherName ||
                user?.data?.name ||
                "Teacher"}

            </div>


            <div className="text-sm text-blue-800 mt-1">

              <strong>
                Assigned Class:
              </strong>{" "}

              {assignedClass}

            </div>

          </div>

        )}


      {/* ====================================================
          FILTERS
      ===================================================== */}

      <div className="bg-white rounded-lg shadow p-4 mb-6">

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">


          {/* ==================================================
              ACADEMIC YEAR
          =================================================== */}

          <div>

            <label className="block text-sm font-medium text-gray-700 mb-1">

              Academic Year

            </label>


            <select

              value={academicYear}

              onChange={(e) =>
                setAcademicYear(
                  e.target.value
                )
              }

              disabled={
                loading
              }

              className="w-full border border-gray-300 rounded-md shadow-sm text-sm p-2"

            >

              <option value="">
                Select Academic Year
              </option>


              {academicYears.map(
                (year) => (

                  <option
                    key={year}
                    value={year}
                  >
                    {year}
                  </option>

                )
              )}

            </select>

          </div>


          {/* ==================================================
              CLASS
          =================================================== */}

          <div>

            <label className="block text-sm font-medium text-gray-700 mb-1">

              Class

            </label>


            <select

              value={selectedClass}

              onChange={(e) =>
                setSelectedClass(
                  e.target.value
                )
              }

              disabled={
                isClassRestricted ||
                loading
              }

              className="w-full border border-gray-300 rounded-md shadow-sm text-sm p-2"

            >

              <option value="">
                Select Class
              </option>


              {availableClasses.map(
                (className) => (

                  <option
                    key={className}
                    value={className}
                  >
                    {className}
                  </option>

                )
              )}

            </select>


            {isClassRestricted && (

              <p className="text-xs text-gray-500 mt-1">

                This class is assigned to you as
                Form Teacher.

              </p>

            )}

          </div>

        </div>

      </div>


      {/* ====================================================
          CLASS SUMMARY
      ===================================================== */}

      {academicYear &&
        selectedClass && (

          <div className="bg-white rounded-lg shadow p-4 mb-6">

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">

              <div>

                <h2 className="text-lg font-semibold text-gray-800">

                  {selectedClass}

                </h2>

                <p className="text-sm text-gray-500">

                  Academic Year:{" "}

                  <strong>
                    {academicYear}
                  </strong>

                </p>

              </div>


              <div className="text-sm text-gray-600">

                Total Pupils:{" "}

                <span className="font-bold text-gray-900">

                  {filteredPupils.length}

                </span>

              </div>

            </div>

          </div>

        )}


      {/* ====================================================
          PUPILS TABLE
      ===================================================== */}

      <div className="bg-white rounded-lg shadow overflow-hidden">

        {loading ? (

          <div className="p-8 text-center text-gray-500">

            Loading pupils...

          </div>

        ) : !academicYear ||
          !selectedClass ? (

          <div className="p-8 text-center text-gray-500">

            Please select an academic year and class.

          </div>

        ) : filteredPupils.length === 0 ? (

          <div className="p-8 text-center text-gray-500">

            No pupils found for{" "}

            <strong>
              {selectedClass}
            </strong>{" "}

            in{" "}

            <strong>
              {academicYear}
            </strong>.

          </div>

        ) : (

          <div className="overflow-x-auto">

            <table className="min-w-full divide-y divide-gray-200">

              <thead className="bg-gray-50">

                <tr>

                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    #
                  </th>

                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Student ID
                  </th>

                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Student Name
                  </th>

                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Class
                  </th>

                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Academic Year
                  </th>

                </tr>

              </thead>


              <tbody className="bg-white divide-y divide-gray-200">

                {filteredPupils.map(
                  (pupil, index) => (

                    <tr
                      key={
                        pupil.id ||
                        pupil.studentID
                      }

                      className="hover:bg-gray-50"
                    >

                      <td className="px-4 py-3 text-sm text-gray-700">
                        {index + 1}
                      </td>


                      <td className="px-4 py-3 text-sm text-gray-700">
                        {pupil.studentID || "-"}
                      </td>


                      <td className="px-4 py-3 text-sm font-medium text-gray-800">
                        {pupil.studentName || "-"}
                      </td>


                      <td className="px-4 py-3 text-sm text-gray-700">
                        {pupil.class || "-"}
                      </td>


                      <td className="px-4 py-3 text-sm text-gray-700">
                        {pupil.academicYear || "-"}
                      </td>

                    </tr>

                  )
                )}

              </tbody>

            </table>

          </div>

        )}

      </div>

    </div>

  );

};


export default AttendancePageClass;

