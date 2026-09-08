import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import Login from './pages/Login';
import StudentDashboard from './pages/StudentDashboard';
import DepartmentDashboard from './pages/DepartmentDashboard';
import AdminDashboard from './pages/AdminDashboard';
import Bubbles from './components/Bubbles';

import DownloadDues from './pages/DownloadDues';

function App() {
  return (
    <>
      <Bubbles />
      <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/student/dashboard" element={<StudentDashboard />} />
        <Route path="/department/dashboard" element={<DepartmentDashboard />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/download-dues" element={<DownloadDues />} />
      </Routes>
    </Router>
    </>
  );
}

export default App;
