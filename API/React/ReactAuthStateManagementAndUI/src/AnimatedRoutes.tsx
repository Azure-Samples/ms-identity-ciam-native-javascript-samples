import { useLocation, Route, Routes } from "react-router-dom";
import SignUp from "pages/SignUp/SignUp";
import { SignUpChallenge } from "pages/SignUp/SignUpChallenge";
import { SignUpPassword } from "pages/SignUp/SignUpPassword";
import { SignInPassword } from "pages/SignIn/SignInPassword";
import { SignInOTP } from "pages/SignIn/SignInOTP";
import { UserProfile } from "pages/UserProfile";
import { ProtectedRoute } from "pages/ProtectedRoute";
import { SignIn } from "./pages/SignIn/SignIn";
import { AnimatePresence, motion } from "framer-motion";
import { SignUpCompleted } from "pages/SignUp/SignUpCompleted";
import { SignInPlain } from "pages/SingInPlain/SignInPlain";

export const AnimatedRoutes = () => {
  const location = useLocation();

  const animatedProps = {
    initial: { width: 0 },
    animate: { width: "100%" },
    exit: { x: window.innerWidth, transition: { duration: 0.3 } },
  };

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* NO UI Routes */}
        <Route path="/signinplain" element={<SignInPlain />} />
        {/* NO UI Routes */}
        <Route
          path="/"
          element={
            <motion.div {...animatedProps}>
              <SignIn />
            </motion.div>
          }
        />
        <Route
          path="/signin"
          element={
            <motion.div {...animatedProps}>
              <SignIn />
            </motion.div>
          }
        />
        <Route
          path="/signin/password"
          element={
            <motion.div {...animatedProps}>
              <SignInPassword />
            </motion.div>
          }
        />
        <Route
          path="/signin/otp"
          element={
            <motion.div {...animatedProps}>
              <SignInOTP />
            </motion.div>
          }
        />
        <Route
          path="/signup"
          element={
            <motion.div {...animatedProps}>
              <SignUp />
            </motion.div>
          }
        />
        <Route
          path="/signup/challenge"
          element={
            <motion.div {...animatedProps}>
              <SignUpChallenge />
            </motion.div>
          }
        />
        <Route
          path="/signup/password"
          element={
            <motion.div {...animatedProps}>
              <SignUpPassword />
            </motion.div>
          }
        />
        <Route
          path="/signup/completed"
          element={
            <motion.div {...animatedProps}>
              <SignUpCompleted />
            </motion.div>
          }
        />
        <Route
          element={
            <motion.div {...animatedProps}>
              <ProtectedRoute />
            </motion.div>
          }
        >
          <Route
            path="/user"
            element={
              <motion.div {...animatedProps}>
                <UserProfile />
              </motion.div>
            }
          />
        </Route>
      </Routes>
    </AnimatePresence>
  );
};
