import React from 'react';
import { BrowserRouter } from "react-router-dom";
import logo from './logo.svg';
import './App.css';
import { AppRoutes } from './AppRoutes';

function App() {
  return (
    <div className="App">
      <header className="App-header">

      </header>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </div>
  );
}

export default App;
