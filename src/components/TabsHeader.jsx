import React from 'react';
import { Tabs, Tab, Box } from '@mui/material';

// TabsHeader.js
export const TabsHeader = ({ activeTab, setActiveTab }) => {
  return (
    <Box sx={{ width: '100%', bgcolor: '#f5f7fa', borderBottom: 1, borderColor: 'divider' }}>
      <Tabs 
        value={activeTab} 
        onChange={(e, newValue) => setActiveTab(newValue)} 
        variant="fullWidth"
        sx={{
          '& .MuiTab-root': { 
            textTransform: 'none', 
            fontWeight: 'bold', 
            fontSize: '0.9rem' // Giảm nhẹ để đủ chỗ cho 4 tab
          },
          '& .Mui-selected': { color: '#fff !important', bgcolor: '#1976d2' },
          '& .MuiTabs-indicator': { display: 'none' }
        }}
      >
        <Tab label="Chủ động" />
        <Tab label="Tự động" />
        <Tab label="Đẩy lên Cloud" />
        <Tab label="Quản lý Gmail" />
        <Tab label="History" />
      </Tabs>
    </Box>
  );
};