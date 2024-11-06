import * as React from "react";
import { alpha, styled } from "@mui/material/styles";
import Box from "@mui/material/Box";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import MenuItem from "@mui/material/MenuItem";
import Drawer from "@mui/material/Drawer";
import MenuIcon from "@mui/icons-material/Menu";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { Popover, TextField, Typography } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "state/store";
import { useNavigate } from "react-router-dom";
import { signInChallengeAction, signInStartAction, signInTokenAction } from "state/authState";

const StyledToolbar = styled(Toolbar)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexShrink: 0,
  borderRadius: `calc(${theme.shape.borderRadius}px + 8px)`,
  backdropFilter: "blur(24px)",
  border: "1px solid",
  borderColor: theme.palette.divider,
  backgroundColor: alpha(theme.palette.background.default, 0.4),
  boxShadow: theme.shadows[1],
  padding: "8px 12px",
}));

const SignInForm: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    dispatch(
      signInStartAction({
        username: data.get("email2") as string,
        password: data.get("password2") as string,
      })
    ).then((action) => {
      if (action.meta.requestStatus === "fulfilled") {
        dispatch(signInChallengeAction({})).then((action) => {
          if (action.meta.requestStatus === "fulfilled") {
            const challengeType = action.payload.challenge_type;

            dispatch(
              signInTokenAction({
                password: data.get("password2") as string,
                grant_type: "password",
                oob: "",
              })
            ).then((action) => {
              if (action.meta.requestStatus === "fulfilled") {
                navigate("/user");
              }
            });
          }
        });
      }
    });
  };

  return (
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
      <TextField label="Email" type="email" fullWidth required margin="dense" id="email2" name="email2" />
      <TextField label="Password" type="password" fullWidth required margin="dense" id="password2" name="password2" />
      <Button variant="outlined" type="submit">
        Sign in
      </Button>
    </Box>
  );
};

export const CustomAppBar = () => {
  const [open, setOpen] = React.useState(false);

  const toggleDrawer = (newOpen: boolean) => () => {
    setOpen(newOpen);
  };

  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const openPop = Boolean(anchorEl);
  const id = open ? "simple-popover" : undefined;

  return (
    <AppBar position="fixed" sx={{ boxShadow: 0, bgcolor: "transparent", backgroundImage: "none", mt: 1 }}>
      <Container maxWidth="lg">
        <StyledToolbar variant="dense" disableGutters>
          <Box sx={{ flexGrow: 1, display: "flex", alignItems: "center", px: 0 }}>
            <Box sx={{ display: { xs: "none", md: "flex" } }}>
              <Button variant="text" color="info" size="small" href="/signinplain">
                Sign In plain
              </Button>
              <Button variant="text" color="info" size="small" href="/signin">
                Sign In with steps
              </Button>
              <Button variant="text" color="info" size="small" href="/signupplain">
                Sign up plain
              </Button>
              <Button variant="text" color="info" size="small"  href="/user">
                User Profile
              </Button>
            </Box>
          </Box>
          <Box
            sx={{
              display: { xs: "none", md: "flex" },
              gap: 1,
              alignItems: "center",
            }}
          >
            <Button color="primary" variant="text" size="small" onClick={handleClick}>
              Sign in
            </Button>
            <Popover
              id={id}
              open={openPop}
              anchorEl={anchorEl}
              onClose={handleClose}
              anchorOrigin={{
                vertical: "bottom",
                horizontal: "left",
              }}
              transformOrigin={{
                vertical: "top",
                horizontal: "left",
              }}
              slotProps={{
                paper: {
                  sx: {
                    padding: 2, // Add padding inside the popover
                    boxShadow: 3, // Optional: adds a nice shadow effect
                    borderRadius: 2, // Optional: rounded corners for a softer look
                  },
                },
              }}
            >
              <Typography sx={{ padding: 2 }}>Sign In</Typography>
              <SignInForm />
            </Popover>

            <Button color="primary" variant="contained" size="small" href="/signup">
              Sign up
            </Button>
          </Box>
          <Box sx={{ display: { sm: "flex", md: "none" } }}>
            <IconButton aria-label="Menu button" onClick={toggleDrawer(true)}>
              <MenuIcon />
            </IconButton>
            <Drawer anchor="top" open={open} onClose={toggleDrawer(false)}>
              <Box sx={{ p: 2, backgroundColor: "background.default" }}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <IconButton onClick={toggleDrawer(false)}>
                    <CloseRoundedIcon />
                  </IconButton>
                </Box>
                <Divider sx={{ my: 3 }} />
                <MenuItem>Sign In plain</MenuItem>
                <MenuItem>Sign up plain</MenuItem>
                <MenuItem>User profile</MenuItem>
                <MenuItem>
                  <Button color="primary" variant="contained" fullWidth>
                    Sign up
                  </Button>
                </MenuItem>
                <MenuItem>
                  <Button color="primary" variant="outlined" fullWidth onClick={handleClick}>
                    Sign in
                  </Button>
                </MenuItem>
              </Box>
            </Drawer>
          </Box>
        </StyledToolbar>
      </Container>
    </AppBar>
  );
};
