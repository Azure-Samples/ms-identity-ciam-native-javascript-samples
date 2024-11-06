import React from 'react';
import { Link } from 'react-router-dom';

export const SignUpCompleted: React.FC = () => {
  return (
    <div className="sign-up-completed">
      <h2>Sign Up Completed</h2>
      <p>Your sign-up process is complete. You can now log in.</p>
      <Link to="/signin" className="login-link">Go to Login</Link>
    </div>
  );
};

