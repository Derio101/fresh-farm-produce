# Fresh Farm Produce Client

This is the frontend React application for the Fresh Farm Produce project. It provides a user interface for customers to submit information about their interest in farm products and view all submissions.

## Features

- Modern, responsive UI built with React and Tailwind CSS
- Form validation for user inputs
- Integration with backend API for data storage and retrieval
- Dynamic routing using React Router

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone the repository
2. Navigate to the client directory
```
cd fresh-farm-project/client
```

3. Install dependencies
```
npm install
```

4. Start the development server
```
npm start
```

The application will open in your default browser at [http://localhost:3000](http://localhost:3000).

## Available Scripts

- `npm start`: Runs the app in development mode
- `npm build`: Builds the app for production
- `npm test`: Runs the test suite
- `npm eject`: Ejects from Create React App

## Pages

### Home Page
- Contact form for customer inquiries
- Form validation for all fields
- Success message after submission

### Farm Sales Page
- Displays all submitted inquiries
- Organized view of customer information
- Responsive layout for all screen sizes

## API Integration

This client connects to a RESTful API built with Node.js, Express, and MongoDB. Make sure the API server is running before using this application.

Default API URL: `http://localhost:5001/api`