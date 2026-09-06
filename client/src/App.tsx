import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import Login from './pages/Login';
import StudentDashboard from './pages/StudentDashboard';
import DepartmentDashboard from './pages/DepartmentDashboard';
import Bubbles from './components/Bubbles';

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
      </Routes>
    </Router>
    </>
  );
}

export default App;
