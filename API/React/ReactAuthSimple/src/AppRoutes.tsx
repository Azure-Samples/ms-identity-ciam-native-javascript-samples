import { Route, Routes } from "react-router-dom";
import { SignIn } from "./pages/SignIn/SignIn";
import { UserInfo } from "./pages/User/UserInfo";
import { SignUp } from "./pages/SignUp/SignUp";
import { SignUpChallenge } from "./pages/SignUp/SignUpChallenge";
import { SignUpCompleted } from "./pages/SignUp/SignUpCompleted";
import { ResetPassword } from "./pages/ResetAccount/ResetPassword";


export const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<SignUp />} />
      <Route path="/signin" element={<SignIn />} />
      <Route path="/user" element={<UserInfo />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/signup/challenge" element={<SignUpChallenge />} />
      <Route path="/signup/completed" element={<SignUpCompleted />} />
      <Route path="/reset" element={<ResetPassword />} />
    </Routes>
  );
};
