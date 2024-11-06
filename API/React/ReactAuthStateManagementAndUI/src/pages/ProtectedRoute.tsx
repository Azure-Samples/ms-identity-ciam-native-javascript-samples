import React from 'react';
import { useSelector } from 'react-redux';
import { NavLink, Outlet } from 'react-router-dom';
import { RootState } from 'state/store';
import { Box, Button, Typography, Card, CardContent } from '@mui/material';

export const ProtectedRoute: React.FC = () => {
  const { isAuth } = useSelector((state: RootState) => state.authState);

  // Show unauthorized screen if no user is found in redux store
  if (!isAuth) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        height="100vh" 
        bgcolor="background.default"
        padding={2}
      >
        <Card sx={{ maxWidth: 400, padding: 3 }}>
          <CardContent>
            <Typography variant="h4" component="h1" gutterBottom align="center">
              Unauthorized
            </Typography>
            <Typography variant="body1" color="textSecondary" align="center" gutterBottom>
              You do not have access to this page. Please log in to continue.
            </Typography>
            <Box mt={2} display="flex" justifyContent="center">
              <Button 
                component={NavLink} 
                to="/signin" 
                variant="contained" 
                color="primary"
                size="large"
              >
                Login
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Box>
    );
  }

  // Return child route elements if authenticated
  return <Outlet />;
};
