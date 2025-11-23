import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import Signup from './components/Signup';
import ScanPage from './components/ScanPage';
import ImageViewPage from './components/ImageViewPage';

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/scans/:type" element={<ScanPage />} />
        <Route path="/scan/:type/image/:customName" element={<ImageViewPage />} />
      </Routes>
    </Router>
  );
};

export default App;
