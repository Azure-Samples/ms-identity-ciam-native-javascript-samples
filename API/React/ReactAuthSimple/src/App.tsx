import React from "react";
import { BrowserRouter, Link as LinkTo } from "react-router-dom";
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
                <LinkTo to="/signin">Sign In</LinkTo>
              </li>
              <li>
                <LinkTo to="/signup">Sign Up</LinkTo>
              </li>
              <li>
                <LinkTo to="/reset">Reset Password</LinkTo>
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
