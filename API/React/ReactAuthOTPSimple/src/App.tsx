import React from "react";
import { BrowserRouter, Link } from "react-router-dom";
import "./App.css";
import { AppRoutes } from "./AppRoutes";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <header>
          <nav>
            <ul>
              <li>
                <Link to="/signin">Sign In</Link>
              </li>
              <li>
                <Link to="/signup">Sign Up</Link>
              </li>
              <li>
                <Link to="/reset">Reset Password</Link>
              </li>
            </ul>
          </nav>
        </header>
        <AppRoutes />
      </BrowserRouter>
    </div>
  );
}

export default App;
