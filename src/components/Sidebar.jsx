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
import { keyframes } from '@mui/material';

const neonFlow = keyframes`
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

const azureGlow = keyframes`
  0%, 100% { filter: drop-shadow(0 0 5px rgba(0, 242, 254, 0.4)); }
  50% { filter: drop-shadow(0 0 15px rgba(79, 172, 254, 0.8)); }
`;




const Sidebar = ({ activeTab, setActiveTab, onLogout }) => {


  const [isCollapsed, setIsCollapsed] = React.useState(false);

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
    <>
      <Paper
        elevation={0}
        sx={{
          width: isCollapsed ? 80 : 260, // Thay đổi độ rộng động
          flexShrink: 0, // TUYỆT ĐỐI KHÔNG CHO PHÉP SIDEBAR CO LẠI
          height: '100vh',
          bgcolor: '#1a2035',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 0,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', // Hiệu ứng co giãn mượt
          overflowX: 'hidden',
          borderRight: '1px solid rgba(255,255,255,0.05)',

          // --- THÊM 2 DÒNG NÀY ĐỂ CHỐNG TRÔI ---
          position: 'sticky',
          top: 0,
          zIndex: 1000, // Đảm bảo sidebar luôn nằm trên nội dung khi cuộn
        }}
      >

        <Box sx={{
          p: isCollapsed ? 2 : 3,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'relative'
        }}>
          {/* Nút bấm thu nhỏ/mở rộng */}
          <ListItemButton
            onClick={() => setIsCollapsed(!isCollapsed)}
            sx={{
              position: 'absolute',
              right: isCollapsed ? 15 : 10,
              top: 10,
              borderRadius: '50%',
              minWidth: 40,
              p: 1
            }}
          >
            <DnsIcon sx={{ fontSize: 20, color: '#00f2fe', transform: isCollapsed ? 'rotate(180deg)' : 'none', transition: '0.3s' }} />
          </ListItemButton>

          {/* Logo chữ - Ẩn khi thu nhỏ */}
          {!isCollapsed && (
            <>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 900,
                  letterSpacing: 2,
                  fontSize: '1.4rem',
                  background: 'linear-gradient(90deg, #00f2fe, #4facfe, #00f2fe, #4facfe)',
                  backgroundSize: '300% 300%',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  animation: `${neonFlow} 4s ease infinite, ${azureGlow} 3s ease-in-out infinite`,
                  display: 'inline-block',
                  textTransform: 'uppercase',
                  mt: 2
                }}
              >
                BACKUP TOOL
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.6, color: '#4facfe', fontWeight: 'bold' }}>
                v1.0.0 Pro Edition
              </Typography>
            </>
          )}
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
                mb: 1.5,
                mx: 1.5,
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                px: isCollapsed ? 1 : 2,
                py: 1.2,
                position: 'relative',
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                color: 'rgba(255,255,255,0.6)', // Màu mặc định khi chưa hover

                // Hiệu ứng chung khi Hover HOẶC Selected
                '&:hover, &.Mui-selected': {
                  bgcolor: 'rgba(0, 210, 255, 0.08)', // Nền xanh mờ cực nhẹ
                  color: '#00d2ff', // Màu fallback cho trình duyệt cũ

                  // Target vào Icon
                  '& .MuiListItemIcon-root': {
                    background: 'linear-gradient(135deg, #00d2ff 0%, #3a7bd5 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    filter: 'drop-shadow(0 0 8px rgba(0, 210, 255, 0.5))',
                    transform: isCollapsed ? 'scale(1.15)' : 'none',
                  },

                  // Target vào Text
                  '& .MuiListItemText-primary': {
                    background: 'linear-gradient(90deg, #00d2ff, #3a7bd5, #00d2ff)',
                    backgroundSize: '200% auto',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    animation: 'shine 2s linear infinite', // Hiệu ứng chữ lấp lánh
                    fontWeight: 700,
                  }
                },

                '&.Mui-selected': {
                  bgcolor: 'rgba(0, 210, 255, 0.12)',
                  // Thanh chỉ thị bên cạnh
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    left: -4,
                    height: '50%',
                    width: '4px',
                    borderRadius: '4px',
                    background: '#00d2ff',
                    boxShadow: '0 0 15px #00d2ff',
                  },
                },

                '&:hover': {
                  transform: isCollapsed ? 'none' : 'translateX(6px)',
                },

                // Định nghĩa animation cho luồng màu chạy trên chữ
                '@keyframes shine': {
                  '0%': { backgroundPosition: '0% center' },
                  '100%': { backgroundPosition: '200% center' },
                },
              }}
            >
              <ListItemIcon
                sx={{
                  color: 'inherit',
                  minWidth: isCollapsed ? 0 : 40,
                  justifyContent: 'center',
                  transition: 'all 0.3s ease',
                }}
              >
                {/* Đảm bảo icon có thể nhận màu từ background-clip */}
                {React.cloneElement(item.icon, {
                  style: {
                    fontSize: '1.5rem',
                    transition: 'all 0.3s ease'
                  }
                })}
              </ListItemIcon>

              {!isCollapsed && (
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    fontSize: '0.95rem',
                    fontWeight: 500,
                    letterSpacing: '0.4px',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.3s ease',
                  }}
                />
              )}
            </ListItemButton>
          ))}
        </List>

        {/* NÚT LOGOUT RIÊNG BIỆT Ở DƯỚI CÙNG (Chỉ hiện khi có truyền onLogout) */}
        {onLogout && (
          <Box sx={{ p: 2 }}>
            <Divider sx={{ bgcolor: 'rgba(255,255,255,0.1)', mb: 2 }} />
            <ListItemButton
              onClick={onLogout}
              sx={{
                borderRadius: '12px',
                color: '#ff4d4d', // Màu đỏ mặc định cho text và icon
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.3s ease-in-out',

                // Trạng thái Hover và Click (Mui-selected hoặc :active)
                '&:hover, &:active': {
                  color: '#fff', // Chữ chuyển sang trắng
                  background: 'linear-gradient(45deg, #ff4d4d, #b30000, #ff4d4d)', // Gradient đỏ đậm
                  backgroundSize: '200% 200%',
                  animation: 'gradientMove 1.5s ease infinite', // Animation chạy dải màu
                  boxShadow: '0 4px 15px rgba(255, 77, 77, 0.4)',
                  transform: 'translateY(-2px)', // Nhấc nhẹ nút lên

                  '& .MuiListItemIcon-root': {
                    color: '#fff',
                    transform: 'rotate(-10deg)', // Xoay nhẹ icon logout tạo hiệu ứng động
                  },
                },

                // Tinh chỉnh Icon mặc định
                '& .MuiListItemIcon-root': {
                  color: '#ff4d4d',
                  minWidth: 40,
                  transition: 'all 0.3s ease',
                },

                // Tinh chỉnh Text mặc định
                '& .MuiListItemText-primary': {
                  fontWeight: 700,
                  letterSpacing: '0.5px',
                },

                // Định nghĩa animation cho nền
                '@keyframes gradientMove': {
                  '0%': { backgroundPosition: '0% 50%' },
                  '50%': { backgroundPosition: '100% 50%' },
                  '100%': { backgroundPosition: '0% 50%' },
                },
              }}
            >
              <ListItemIcon>
                <LogoutIcon />
              </ListItemIcon>
              {!isCollapsed && (
                <ListItemText primary="Đăng xuất" />
              )}
            </ListItemButton>
          </Box>
        )}
      </Paper>
    </>


  );
};

export default Sidebar;