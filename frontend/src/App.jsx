import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./auth/ProtectedRoute.jsx";
import Layout from "./components/Layout.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Students from "./pages/Students.jsx";
import Faculty from "./pages/Faculty.jsx";
import Programs from "./pages/Programs.jsx";
import AcademicYears from "./pages/AcademicYears.jsx";
import Semesters from "./pages/Semesters.jsx";
import Courses from "./pages/Courses.jsx";
import Attendance from "./pages/Attendance.jsx";
import Exams from "./pages/Exams.jsx";
import Marks from "./pages/Marks.jsx";
import Competencies from "./pages/Competencies.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/students" element={<Students />} />
        <Route path="/faculty" element={<Faculty />} />
        <Route path="/programs" element={<Programs />} />
        <Route path="/academic-years" element={<AcademicYears />} />
        <Route path="/semesters" element={<Semesters />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/exams" element={<Exams />} />
        <Route path="/marks" element={<Marks />} />
        <Route path="/competencies" element={<Competencies />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
