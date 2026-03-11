import React from 'react';
import { Tabs, Tab, Box } from '@mui/material';

export const TabsHeader = ({ activeTab, setActiveTab }) => {
  return (
    <Box sx={{ width: '100%', bgcolor: '#f5f7fa', borderBottom: 1, borderColor: 'divider' }}>
      <Tabs 
        value={activeTab} 
        onChange={(e, newValue) => setActiveTab(newValue)} 
        variant="fullWidth"
        sx={{
          '& .MuiTab-root': { textTransform: 'none', fontWeight: 'bold', fontSize: '1rem' },
          '& .Mui-selected': { color: '#fff !important', bgcolor: '#1976d2' },
          '& .MuiTabs-indicator': { display: 'none' }
        }}
      >
        <Tab label="Chủ động" />
        <Tab label="Tự động" />
      </Tabs>
    </Box>
  );
};