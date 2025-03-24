import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/common/Navbar';
import Footer from './components/common/Footer';
import IndexPage from './pages/IndexPage';
import FarmSalesPage from './pages/FarmSalesPage';
import { OfflineProvider } from './context/OfflineContext';

/**
 * Main App Component - Simplified with routing and layout
 */
function App() {
  const [formData, setFormData] = useState(null);
  
  const handleFormSubmission = (data) => {
    setFormData(data);
  };

  return (
    <OfflineProvider>
      <Router>
        <div className="min-h-screen bg-green-50">
          <Navbar />
          <div className="container mx-auto p-4">
            <Routes>
              <Route path="/" element={<IndexPage onFormSubmit={handleFormSubmission} />} />
              <Route 
                path="/farm-sales" 
                element={<FarmSalesPage formData={formData} />} 
              />
            </Routes>
          </div>
          <Footer />
        </div>
      </Router>
    </OfflineProvider>
  );
}

export default App;