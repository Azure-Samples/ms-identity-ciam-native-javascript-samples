import * as React from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormLabel from "@mui/material/FormLabel";
import FormControl from "@mui/material/FormControl";
import { Link as LinkTo } from "react-router-dom";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { GoogleIcon, FacebookIcon, SitemarkIcon } from "../../components/CustomIcons";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { signUpChallengeAction, signUpStart } from "state/authState";
import { SignUpForm } from "interfaces/SignUpInterfaces";
import { AppDispatch, RootState } from "state/store";
import { Alert, LinearProgress } from "@mui/material";
import { CustomCard } from "../../components/CustomCard";

export default function SignUp() {
  const [emailError, setEmailError] = React.useState(false);
  const [emailErrorMessage, setEmailErrorMessage] = React.useState("");
  const [passwordError, setPasswordError] = React.useState(false);
  const [passwordErrorMessage, setPasswordErrorMessage] = React.useState("");
  const [nameError, setNameError] = React.useState(false);
  const [nameErrorMessage, setNameErrorMessage] = React.useState("");
  const [surnameError, setSurnameError] = React.useState(false);
  const [surnameErrorMessage, setSurnameErrorMessage] = React.useState("");
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { loading, error } = useSelector((state: RootState) => state.authState);

  const validateInputs = () => {
    const email = document.getElementById("email") as HTMLInputElement;
    const password = document.getElementById("password") as HTMLInputElement;
    const name = document.getElementById("name") as HTMLInputElement;
    const surname = document.getElementById("surname") as HTMLInputElement;

    let isValid = true;

    if (!email.value || !/\S+@\S+\.\S+/.test(email.value)) {
      setEmailError(true);
      setEmailErrorMessage("Please enter a valid email address.");
      isValid = false;
    } else {
      setEmailError(false);
      setEmailErrorMessage("");
    }

    if (!password.value || password.value.length < 6) {
      setPasswordError(true);
      setPasswordErrorMessage("Password must be at least 6 characters long.");
      isValid = false;
    } else {
      setPasswordError(false);
      setPasswordErrorMessage("");
    }

    if (!name.value || name.value.length < 1) {
      setNameError(true);
      setNameErrorMessage("Name is required.");
      isValid = false;
    } else {
      setNameError(false);
      setNameErrorMessage("");
    }

    if (!surname.value || surname.value.length < 1) {
      setSurnameError(true);
      setSurnameErrorMessage("Name is required.");
      isValid = false;
    } else {
      setSurnameError(false);
      setSurnameErrorMessage("");
    }

    return isValid;
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    console.log({
      name: data.get("name"),
      lastName: data.get("lastName"),
      email: data.get("email"),
      password: data.get("password"),
    });
    const signUpForm: SignUpForm = {
      name: data.get("name") as string,
      surname: data.get("surname") as string,
      email: data.get("email") as string,
      password: data.get("password") as string,
    };

    dispatch(signUpStart(signUpForm)).then((action) => {
      if (action.meta.requestStatus === "fulfilled") {
        dispatch(signUpChallengeAction({})).then((action) => {
          if (action.meta.requestStatus === "fulfilled") {
            navigate("/signup/challenge");
          }
        });
      }
    });
  };

  return (
    <>
      <CustomCard variant="outlined">
        {loading && <LinearProgress />}
        <SitemarkIcon />
        <Typography component="h1" variant="h4" sx={{ width: "100%", fontSize: "clamp(2rem, 10vw, 2.15rem)" }}>
          Sign up with attributes
        </Typography>
        <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <FormControl>
            <FormLabel htmlFor="name">First name</FormLabel>
            <TextField
              disabled={loading}
              autoComplete="name"
              name="name"
              required
              fullWidth
              id="name"
              placeholder="Jon"
              error={nameError}
              helperText={nameErrorMessage}
              color={nameError ? "error" : "primary"}
            />
          </FormControl>
          <FormControl>
            <FormLabel htmlFor="surname">Surname</FormLabel>
            <TextField
              disabled={loading}
              autoComplete="surname"
              name="surname"
              required
              fullWidth
              id="surname"
              placeholder="Snow"
              error={surnameError}
              helperText={surnameErrorMessage}
              color={surnameError ? "error" : "primary"}
            />
          </FormControl>
          <FormControl>
            <FormLabel htmlFor="email">Email</FormLabel>
            <TextField
              disabled={loading}
              required
              fullWidth
              id="email"
              placeholder="your@email.com"
              name="email"
              autoComplete="email"
              variant="outlined"
              error={emailError}
              helperText={emailErrorMessage}
              color={passwordError ? "error" : "primary"}
            />
          </FormControl>
          <FormControl>
            <FormLabel htmlFor="password">Password</FormLabel>
            <TextField
              disabled={loading}
              required
              fullWidth
              name="password"
              placeholder="••••••"
              type="password"
              id="password"
              autoComplete="new-password"
              variant="outlined"
              error={passwordError}
              helperText={passwordErrorMessage}
              color={passwordError ? "error" : "primary"}
            />
          </FormControl>
          <FormControlLabel control={<Checkbox value="allowExtraEmails" color="primary" />} label="I want to receive updates via email." />
          {error && <Alert severity="error">{error}</Alert>}
          <Button type="submit" fullWidth variant="contained" onClick={validateInputs} disabled={loading}>
            Next
          </Button>
          <Typography sx={{ textAlign: "center" }}>
            Already have an account?{" "}
            <span>
              <LinkTo to="/signin">Sign in</LinkTo>
            </span>
          </Typography>
        </Box>
        <Divider>
          <Typography sx={{ color: "text.secondary" }}>or</Typography>
        </Divider>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Button type="submit" fullWidth variant="outlined" onClick={() => alert("Sign up with Google")} startIcon={<GoogleIcon />}>
            Sign up with Google
          </Button>
          <Button type="submit" fullWidth variant="outlined" onClick={() => alert("Sign up with Facebook")} startIcon={<FacebookIcon />}>
            Sign up with Facebook
          </Button>
        </Box>
      </CustomCard>
    </>
  );
}
