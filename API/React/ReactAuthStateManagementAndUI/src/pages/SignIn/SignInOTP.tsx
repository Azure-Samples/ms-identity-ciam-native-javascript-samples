import * as React from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormControl from "@mui/material/FormControl";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useDispatch, useSelector } from "react-redux";
import { Link as LinkTo, useNavigate } from "react-router-dom";
import { SitemarkIcon } from "../../components/CustomIcons";
import { CustomCard } from "../../components/CustomCard";
import { AppDispatch, RootState } from "state/store";
import { signInTokenAction } from "state/authState";
import { Alert, LinearProgress } from "@mui/material";

export function SignInOTP() {
  const [oobError, setOobError] = React.useState(false);
  const [oobErrorMessage, setOobErrorMessage] = React.useState("");
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { loading, error } = useSelector((state: RootState) => state.authState);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    dispatch(
      signInTokenAction({
        oob: data.get("oob") as string,
        grant_type: "oob",
        password: "",
      })
    ).then((action) => {
      if (action.meta.requestStatus === "fulfilled") {
        navigate("/user");
      }
    });
  };

  const validateInputs = () => {
    const oob = document.getElementById("oob") as HTMLInputElement;
    let isValid = true;

    if (!oob.value || oob.value.length < 6) {
      setOobError(true);
      setOobErrorMessage("One time code must be at least 6 characters long.");
      isValid = false;
    } else {
      setOobError(false);
      setOobErrorMessage("");
    }

    return isValid;
  };

  return (
    <>
      <CustomCard variant="outlined">
        {loading && <LinearProgress />}
        <SitemarkIcon />
        <Typography component="h1" variant="h4" sx={{ width: "100%", fontSize: "clamp(2rem, 10vw, 2.15rem)" }}>
          Enter password
        </Typography>
        <Box
          component="form"
          onSubmit={handleSubmit}
          noValidate
          sx={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            gap: 2,
          }}
        >
          <FormControl disabled={loading}>
            <TextField
              disabled={loading}
              error={oobError}
              helperText={oobErrorMessage}
              name="oob"
              placeholder="••••••"
              type="text"
              id="oob"
              autoFocus
              required
              fullWidth
              variant="outlined"
              color={oobError ? "error" : "primary"}
            />
          </FormControl>
          <FormControlLabel control={<Checkbox value="remember" color="primary" />} label="Remember me" />
          {error && <Alert severity="error">{error}</Alert>}
          <Button type="submit" fullWidth variant="contained" onClick={validateInputs} disabled={loading}>
            Sign in
          </Button>
          <Typography sx={{ textAlign: "center" }}>
            Don&apos;t have an account?{" "}
            <span>
              <LinkTo to="/signup">Sign up</LinkTo>
            </span>
          </Typography>
        </Box>
      </CustomCard>
    </>
  );
}
