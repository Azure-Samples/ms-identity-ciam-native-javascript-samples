import React from "react";
import { Card, CardContent, Typography, Box, Divider } from "@mui/material";
import { useSelector } from "react-redux";
import { RootState } from "state/store";
import { parseJwt } from "services/Utils";
import { CustomCard } from "../components/CustomCard";
import { SitemarkIcon } from "../components/CustomIcons";

// The UserProfile component
export const UserProfile: React.FC = () => {
  const { access_token, id_token } = useSelector((state: RootState) => state.authState);
  const decodedToken = parseJwt(access_token);
  const { given_name, scp, family_name, unique_name: email, exp } = decodedToken;
  const expiryDate = new Date(exp * 1000).toLocaleString();

  return (
    <CustomCard variant="outlined">
      <SitemarkIcon />

      <CardContent>
        <Typography component="h1" variant="h4" sx={{ width: "100%", fontSize: "clamp(2rem, 10vw, 2.15rem)" }}>
          User Profile
        </Typography>

        <Divider />

        {/* Name */}
        <Box mt={2} mb={1}>
          <Typography variant="body1" color="textSecondary">
            <strong>Given Name:</strong> {given_name}
          </Typography>
        </Box>

        {/* Surname */}
        <Box mb={1}>
          <Typography variant="body1" color="textSecondary">
            <strong>Family Name:</strong> {family_name}
          </Typography>
        </Box>

        {/* Email */}
        <Box mb={1}>
          <Typography variant="body1" color="textSecondary">
            <strong>Email:</strong> {email}
          </Typography>
        </Box>

        {/* Login Time / Token Info */}
        <Box mb={1}>
          <Typography variant="body1" color="textSecondary">
            <strong>Expire time:</strong> {expiryDate}
          </Typography>
        </Box>
        <Box mb={1}>
          <Typography variant="body1" color="textSecondary">
            <strong>Scopes:</strong> {scp}
          </Typography>
        </Box>
      </CardContent>
    </CustomCard>
  );
};
