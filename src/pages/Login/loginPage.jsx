import React, { useState } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Container,
  InputAdornment,
  IconButton,
  Stack,
  FormControl,
  FormLabel,
  Paper
} from '@mui/material';
import { Visibility, VisibilityOff, LockOutlined, PersonOutline } from '@mui/icons-material';

const LoginLayout = ({ onLogin }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleClickShowPassword = () => setShowPassword((show) => !show);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (username.trim()) {
      onLogin(username, password);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
        position: 'relative',
        overflow: 'hidden',

        // --- CẤU HÌNH GRADIENT ĐỘNG TOÀN MÀN HÌNH ---
        backgroundSize: '400% 400%',
        backgroundImage: 'linear-gradient(-45deg, #0f172a, #1e3a8a, #3b82f6, #0ea5e9)',
        animation: 'mainBgGradient 15s ease infinite',

        '@keyframes mainBgGradient': {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },

        // --- THÊM HIỆU ỨNG CÁC ĐỐM SÁNG NEON CHẠY NGẦM ---
        '&::before': {
          content: '""',
          position: 'absolute',
          width: '140%',
          height: '140%',
          top: '-20%',
          left: '-20%',
          background: 'radial-gradient(circle, rgba(0,210,255,0.07) 0%, transparent 70%)',
          animation: 'floatingLight 20s linear infinite',
          zIndex: 0,
        },

        '@keyframes floatingLight': {
          '0%': { transform: 'rotate(0deg) translate(0, 0)' },
          '50%': { transform: 'rotate(180deg) translate(50px, 100px)' },
          '100%': { transform: 'rotate(360deg) translate(0, 0)' },
        }
      }}
    >
      <Container maxWidth="xs">
        <Paper
          elevation={0}
          sx={{
            p: 5,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            borderRadius: '24px',
            // Hiệu ứng Glassmorphism (Kính mờ)
            background: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
          }}
        >
          {/* Logo hoặc Icon biểu tượng */}
          <Box
            sx={{
              width: 65, // Tăng nhẹ kích thước cho oai
              height: 65,
              borderRadius: '18px', // Bo góc hiện đại hơn
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 3,
              position: 'relative',
              zIndex: 1,

              // --- GRADIENT ANIMATION CHUYỂN ĐỘNG ---
              backgroundSize: '200% 200%',
              backgroundImage: 'linear-gradient(45deg, #2563eb, #00d2ff, #60a5fa, #2563eb)',
              animation: 'iconGradient 4s ease infinite, floating 3s ease-in-out infinite',

              // --- HIỆU ỨNG PHÁT SÁNG (GLOW) ---
              boxShadow: '0 10px 25px rgba(37, 99, 235, 0.4), 0 0 15px rgba(0, 210, 255, 0.3)',

              // Keyframes cho màu chạy
              '@keyframes iconGradient': {
                '0%': { backgroundPosition: '0% 50%' },
                '50%': { backgroundPosition: '100% 50%' },
                '100%': { backgroundPosition: '0% 50%' },
              },

              // Keyframes cho hiệu ứng bay nhẹ bồng bềnh
              '@keyframes floating': {
                '0%, 100%': { transform: 'translateY(0)' },
                '50%': { transform: 'translateY(-8px)' },
              },

              // Thêm một lớp bóng đổ phía dưới icon để tạo cảm giác 3D
              '&::after': {
                content: '""',
                position: 'absolute',
                bottom: '-15px',
                left: '15%',
                width: '70%',
                height: '6px',
                background: 'rgba(0,0,0,0.1)',
                borderRadius: '50%',
                filter: 'blur(4px)',
                animation: 'shadowPulse 3s ease-in-out infinite',
              },

              '@keyframes shadowPulse': {
                '0%, 100%': { transform: 'scale(1)', opacity: 0.4 },
                '50%': { transform: 'scale(0.8)', opacity: 0.2 },
              }
            }}
          >
            <LockOutlined sx={{
              color: '#fff',
              fontSize: 34,
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' // Làm icon nổi khối hơn
            }} />
          </Box>

          <Typography variant="h4" sx={{ fontWeight: 800, color: '#1e3a8a', mb: 1 }}>
            Chào mừng
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b', mb: 4, textAlign: 'center' }}>
            Đăng nhập để quản lý hệ thống Backup của bạn
          </Typography>

          <Box component="form" onSubmit={handleSubmit} noValidate sx={{ width: '100%' }}>
            <Stack spacing={3}>

              <FormControl fullWidth>
                <FormLabel sx={{ mb: 1, fontWeight: '600', color: '#1e293b', fontSize: '0.875rem' }}>
                  Tên đăng nhập
                </FormLabel>
                <TextField
                  required
                  fullWidth
                  placeholder="admin..."
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonOutline sx={{ color: '#94a3b8' }} />
                      </InputAdornment>
                    ),
                    sx: {
                      borderRadius: '12px',
                      bgcolor: '#f8fafc',
                      '&:hover': { bgcolor: '#f1f5f9' },
                    }
                  }}
                />
              </FormControl>

              <FormControl fullWidth>
                <FormLabel sx={{ mb: 1, fontWeight: '600', color: '#1e293b', fontSize: '0.875rem' }}>
                  Mật khẩu
                </FormLabel>
                <TextField
                  fullWidth
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockOutlined sx={{ color: '#94a3b8' }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={handleClickShowPassword} edge="end">
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                    sx: {
                      borderRadius: '12px',
                      bgcolor: '#f8fafc',
                      '&:hover': { bgcolor: '#f1f5f9' },
                    }
                  }}
                />
              </FormControl>

              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                sx={{
                  py: 1.8,
                  borderRadius: '14px', // Bo góc tròn hơn một chút cho hiện đại
                  textTransform: 'none',
                  fontSize: '1rem',
                  fontWeight: '800', // Đậm hơn để nổi bật chữ
                  position: 'relative',
                  overflow: 'hidden',
                  color: '#fff',
                  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',

                  // --- HIỆU ỨNG NEON & GRADIENT ANIMATION ---
                  backgroundSize: '200% 200%',
                  backgroundImage: 'linear-gradient(45deg, #00d2ff, #3a7bd5, #00d2ff)',
                  animation: 'neonFlow 3s ease infinite',

                  '@keyframes neonFlow': {
                    '0%': { backgroundPosition: '0% 50%' },
                    '50%': { backgroundPosition: '100% 50%' },
                    '100%': { backgroundPosition: '0% 50%' },
                  },

                  // --- ĐÈN LED GLOW (TỎA SÁNG) ---
                  boxShadow: '0 0 15px rgba(0, 210, 255, 0.4), 0 10px 20px rgba(59, 130, 246, 0.3)',

                  '&:hover': {
                    transform: 'translateY(-3px) scale(1.01)',
                    filter: 'brightness(1.1)',
                    boxShadow: '0 0 25px rgba(0, 210, 255, 0.6), 0 15px 30px rgba(59, 130, 246, 0.4)',
                    '&::after': {
                      left: '100%',
                    }
                  },

                  // --- VỆT SÁNG QUÉT QUA (SHINE EFFECT) ---
                  '&::after': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: '-100%',
                    width: '100%',
                    height: '100%',
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                    transition: 'all 0.6s',
                  },

                  // Hiệu ứng khi nhấn giữ
                  '&:active': {
                    transform: 'scale(0.98)',
                  },

                  // Đảm bảo màu sắc hiển thị tốt kể cả khi bị loading (disabled)
                  '&.Mui-disabled': {
                    backgroundImage: 'linear-gradient(45deg, #1e3a8a, #1e40af, #1e3a8a) !important',
                    color: 'rgba(255,255,255,0.7) !important',
                    opacity: 1,
                    animationDuration: '5s', // Chạy chậm lại khi đang load
                  }
                }}
              >
                Đăng nhập hệ thống
              </Button>
            </Stack>
          </Box>
        </Paper>

        <Typography variant="caption" sx={{ mt: 4, display: 'block', textAlign: 'center', color: 'rgba(255,255,255,0.7)' }}>
          © 2026 Backup System Pro. All rights reserved.
        </Typography>
      </Container>
    </Box>
  );
};

export default LoginLayout;