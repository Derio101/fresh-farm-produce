import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Navbar component for site navigation
 */
function Navbar() {
  return (
    <nav className="bg-green-800 text-white p-4">
      <div className="container mx-auto flex justify-between items-center">
        <div className="text-xl font-bold">Fresh Farm Produce</div>
        <ul className="flex space-x-6">
          <li>
            <Link to="/" className="hover:text-green-200">Home</Link>
          </li>
          <li>
            <Link to="/farm-sales" className="hover:text-green-200">Farm Sales</Link>
          </li>
        </ul>
      </div>
    </nav>
  );
}

export default Navbar;