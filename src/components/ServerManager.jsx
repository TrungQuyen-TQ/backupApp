import React, { useState, useEffect } from 'react';
import { Box, List, ListItem, ListItemText, IconButton, Paper, Typography, Button, Chip, Divider } from '@mui/material';
import LoginIcon from '@mui/icons-material/Login';
import StorageIcon from '@mui/icons-material/Storage';
import DeleteIcon from '@mui/icons-material/Delete';

export const ServerManager = ({ onScanAndConnect, showMsg }) => {
  const [servers, setServers] = useState([]);

  // ServerManager.jsx
  // ServerManager.jsx
  const loadServers = async () => {
    const result = await window.electronAPI.getLoginConfigs();
    if (result.success && result.serverConfigs) {
      // Gom nhóm để mỗi IP chỉ xuất hiện 1 lần duy nhất
      const uniqueServers = result.serverConfigs.reduce((acc, current) => {
        const x = acc.find(item => item.server === current.server);
        if (!x) {
          return acc.concat([current]);
        } else {
          return acc;
        }
      }, []);

      setServers(uniqueServers);
    }
  };

  useEffect(() => { loadServers(); }, []);

  const handleQuickConnect = async (server) => {
    showMsg(`🚀 Đang khởi tạo kết nối tổng lực đến ${server.server}...`, "info");

    // Không gọi onConnect(server) để chuyển tab nữa
    // Mà gọi một hàm xử lý logic quét DB mới
    onScanAndConnect(server);
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, color: '#2c3e50' }}>
        Danh sách Server đã lưu
      </Typography>

      <Paper
        elevation={0}
        sx={{
          bgcolor: "transparent", // Để lộ nền xám nhạt bên dưới
          borderRadius: "16px",
          overflow: "hidden",

        }}
      >
        <List sx={{ p: 0, display: "flex", flexDirection: "column", gap: 2, mt: 2 }}>
          {servers.map((server, index) => (
            <ListItem
              key={index}
              sx={{
                bgcolor: "#fff",
                borderRadius: "12px",
                p: 2,
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                border: "1px solid #f0f2f5",
                display: "flex",
                alignItems: "center",
                "&:hover": {
                  transform: "translateY(-4px)",
                  boxShadow: "0 12px 24px rgba(0,0,0,0.06)",
                  borderColor: "#3a7bd5",
                  "& .server-icon-box": {
                    bgcolor: "#3a7bd5",
                    color: "#fff",
                    transform: "rotate(10deg)",
                  },
                },
              }}
              secondaryAction={
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<LoginIcon />}
                  onClick={() => handleQuickConnect(server)}
                  sx={{
                    borderRadius: '12px',
                    px: 3,
                    py: 1,
                    fontWeight: '800',
                    textTransform: 'none', // Giữ nguyên chữ "Kết nối" không viết hoa hết
                    letterSpacing: '0.5px',
                    color: '#fff',
                    position: 'relative',
                    overflow: 'hidden',
                    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                    zIndex: 1,

                    // --- GRADIENT XANH NEON CHẠY LIÊN TỤC ---
                    backgroundSize: '200% 200%',
                    backgroundImage: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 50%, #00f2fe 100%)',
                    animation: 'neonFlow 3s ease infinite',

                    '@keyframes neonFlow': {
                      '0%': { backgroundPosition: '0% 50%' },
                      '50%': { backgroundPosition: '100% 50%' },
                      '100%': { backgroundPosition: '0% 50%' },
                    },

                    // --- HIỆU ỨNG PHÁT SÁNG (GLOW) ---
                    boxShadow: '0 4px 15px rgba(0, 242, 254, 0.4)',

                    // --- HIỆU ỨNG KHI HOVER (LUNG LINH) ---
                    '&:hover': {
                      transform: 'translateY(-3px) scale(1.05)',
                      boxShadow: '0 8px 25px rgba(0, 242, 254, 0.6)',
                      filter: 'brightness(1.1)',

                      // Hiện vệt sáng quét qua khi hover
                      '&::after': {
                        left: '100%',
                      }
                    },

                    // --- VỆT SÁNG KIM LOẠI (SHINE EFFECT) ---
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: '-100%',
                      width: '100%',
                      height: '100%',
                      background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
                      transition: 'all 0.6s ease-in-out',
                      zIndex: -1,
                    },

                    // Hiệu ứng khi click (nhấn nút)
                    '&:active': {
                      transform: 'scale(0.95)',
                    },

                    // Đảm bảo icon không bị ảnh hưởng bởi hiệu ứng vệt sáng
                    '& .MuiButton-startIcon': {
                      zIndex: 2,
                    }
                  }}
                >
                  Kết nối
                </Button>
              }
            >
              {/* Box Icon với hiệu ứng chuyển màu */}
              <Box
                className="server-icon-box"
                sx={{
                  p: 1.5,
                  mr: 2.5,
                  borderRadius: "12px",
                  bgcolor: "#f0f7ff",
                  color: "#3a7bd5",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.3s ease",
                }}
              >
                <StorageIcon />
              </Box>

              {/* Nội dung text */}
              <ListItemText
                primary={
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#1a2035" }}>
                      {server.server}
                    </Typography>
                    {/* <Chip
                      label={server.dbType?.toUpperCase()}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: "0.65rem",
                        fontWeight: 900,
                        bgcolor: server.dbType === "mongodb" ? "#e6f4ea" : "#e3f2fd",
                        color: server.dbType === "mongodb" ? "#1e8e3e" : "#1976d2",
                        borderRadius: "6px",
                      }}
                    /> */}
                  </Box>
                }
                secondary={
                  <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 500, display: "flex", alignItems: "center", gap: 0.5 }}>
                    <span style={{ opacity: 0.8 }}>User:</span>
                    <b style={{ color: "#334155" }}>{server.dbUser}</b>
                    <span style={{ margin: "0 4px", opacity: 0.3 }}>|</span>
                    <span style={{ opacity: 0.8 }}>Port:</span>
                    <b style={{ color: "#334155" }}>{server.port || server.sshPort}</b>
                  </Typography>
                }
              />
            </ListItem>
          ))}

          {/* Trạng thái trống */}
          {servers.length === 0 && (
            <Paper
              variant="outlined"
              sx={{
                p: 4,
                textAlign: "center",
                borderRadius: "12px",
                borderStyle: "dashed",
                bgcolor: "transparent",
              }}
            >
              <Typography sx={{ color: "#94a3b8", fontWeight: 500 }}>
                Chưa có server nào được lưu.
              </Typography>
            </Paper>
          )}
        </List>
      </Paper>
    </Box>
  );
};