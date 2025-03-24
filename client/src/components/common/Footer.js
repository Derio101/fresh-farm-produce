import React from 'react';

/**
 * Footer component for site
 */
function Footer() {
  return (
    <footer className="bg-green-800 text-white p-4 mt-12">
      <div className="container mx-auto text-center">
        <p>&copy; {new Date().getFullYear()} Fresh Farm Produce. All rights reserved.</p>
      </div>
    </footer>
  );
}

export default Footer;