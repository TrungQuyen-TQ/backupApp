import React from 'react';
import { 
  Box, 
  List, 
  ListItemButton, 
  ListItemIcon, 
  ListItemText, 
  Typography, 
  Divider,
  Paper
} from '@mui/material';
import StorageIcon from '@mui/icons-material/Storage';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import MailIcon from '@mui/icons-material/Mail';
import HistoryIcon from '@mui/icons-material/History';
import LogoutIcon from '@mui/icons-material/Logout';
// Sidebar.jsx - Sửa lại phần import icon
import DnsIcon from '@mui/icons-material/Dns'; // Phải import riêng biệt như thế này

const Sidebar = ({ activeTab, setActiveTab, onLogout }) => {
  // Danh sách các mục Menu tương ứng với activeTab trong App.jsx
  const menuItems = [
  { text: 'Chủ động', icon: <StorageIcon /> },
  { text: 'Tự động', icon: <AutorenewIcon /> },
  { text: 'Quản lý Server', icon: <DnsIcon /> }, // Thêm cái này (nhớ import DnsIcon)
  { text: 'Đẩy lên Cloud', icon: <CloudUploadIcon /> },
  { text: 'Quản lý Gmail', icon: <MailIcon /> },
  { text: 'History', icon: <HistoryIcon /> },
];

  return (
    <Paper 
      elevation={3}
      sx={{ 
        width: 260, 
        height: '100vh', 
        bgcolor: '#1a2035', // Màu xanh đen đậm cực sang cho Desktop App
        color: '#fff',
        display: 'flex', 
        flexDirection: 'column',
        borderRadius: 0,
        position: 'sticky',
        top: 0
      }}
    >
      {/* PHẦN LOGO APP */}
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: 1, color: '#00d2ff' }}>
          BACKUP TOOL
        </Typography>
        <Typography variant="caption" sx={{ opacity: 0.6 }}>v1.0.0 Pro Edition</Typography>
      </Box>

      <Divider sx={{ bgcolor: 'rgba(255,255,255,0.1)' }} />

      {/* DANH SÁCH MENU */}
      <List sx={{ flexGrow: 1, px: 1, mt: 2 }}>
        {menuItems.map((item, index) => (
          <ListItemButton
            key={item.text}
            selected={activeTab === index}
            onClick={() => setActiveTab(index)}
            sx={{
              borderRadius: '12px',
              mb: 1,
              '&.Mui-selected': {
                bgcolor: '#3a7bd5',
                '&:hover': { bgcolor: '#00d2ff' },
              },
              '&:hover': {
                bgcolor: 'rgba(255,255,255,0.05)',
                transform: 'translateX(5px)',
              },
              transition: 'all 0.3s ease',
            }}
          >
            <ListItemIcon sx={{ color: activeTab === index ? '#fff' : 'rgba(255,255,255,0.7)', minWidth: 45 }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText 
              primary={item.text} 
              primaryTypographyProps={{ 
                fontSize: '0.95rem', 
                fontWeight: activeTab === index ? 700 : 500 
              }} 
            />
          </ListItemButton>
        ))}
      </List>

      {/* NÚT LOGOUT RIÊNG BIỆT Ở DƯỚI CÙNG */}
      <Box sx={{ p: 2 }}>
        <Divider sx={{ bgcolor: 'rgba(255,255,255,0.1)', mb: 2 }} />
        <ListItemButton
          onClick={onLogout}
          sx={{
            borderRadius: '12px',
            color: '#ff4d4d',
            '&:hover': {
              bgcolor: 'rgba(255, 77, 77, 0.1)',
              '& .MuiListItemIcon-root': { color: '#ff4d4d' }
            },
          }}
        >
          <ListItemIcon sx={{ color: '#ff4d4d', minWidth: 40 }}>
            <LogoutIcon />
          </ListItemIcon>
          <ListItemText primary="Đăng xuất" primaryTypographyProps={{ fontWeight: 700 }} />
        </ListItemButton>
      </Box>
    </Paper>
  );
};

export default Sidebar;