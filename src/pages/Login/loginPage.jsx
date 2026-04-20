//login mới 





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
        // --- CỐ ĐỊNH KHUNG HÌNH VÀ XÓA SCROLL ---
        height: '100vh', 
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 0,
        position: 'relative',
        overflow: 'hidden', // Chỉ khóa cuộn tại Layout này

        // --- GRADIENT TĨNH (KHÔNG ANIMATION) ---
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #0ea5e9 100%)',
      }}
    >
      <Container 
        maxWidth="xs" 
        sx={{ 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center',
          zIndex: 1 
        }}
      >
        <Paper
          elevation={0}
          sx={{
            p: 4, 
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            borderRadius: '24px',
            background: 'rgba(255, 255, 255, 0.88)', // Tăng độ đục một chút cho rõ
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
            overflow: 'hidden', // Đảm bảo Paper không tự hiện scroll nội bộ
          }}
        >
          {/* Biểu tượng Tam giác lơ lửng */}
          <Box
            sx={{
              width: 120, 
              height: 120,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 0, 
              mt: -1, 
              position: 'relative',
              animation: 'triangleFloat 4s ease-in-out infinite',
              '@keyframes triangleFloat': {
                '0%, 100%': { transform: 'translateY(0px)' },
                '50%': { transform: 'translateY(6px)' },
              },
            }}
          >
            <svg viewBox="0 0 2000 2000" style={{ width: '100%', height: '100%', filter: 'drop-shadow(0 0 12px rgba(0, 210, 255, 0.6))', display: 'block' }}>
               <defs>
                 <style>
                   {`
                     @keyframes neon1 { 0%, 100% { fill: #00d2ff; } 34% { fill: #3a7bd5; } 66% { fill: #00f2fe; } }
                     @keyframes neon2 { 0%, 100% { fill: #00f2fe; } 34% { fill: #00d2ff; } 66% { fill: #3a7bd5; } }
                     @keyframes neon3 { 0%, 100% { fill: #3a7bd5; } 34% { fill: #00f2fe; } 66% { fill: #00d2ff; } }
                   `}
                 </style>
               </defs>
               <polygon points="928 781 1021 951 784.5 1371.97 1618 1371.97 1530.32 1544 509 1539 928 781" style={{ strokeWidth: 0, animation: 'neon1 4s ease infinite both' }} />
               <polygon points="1618 1371.97 784.5 1371.97 874.93 1211 1346 1211 923.1 456 1110.06 456 1618 1371.97" style={{ strokeWidth: 0, animation: 'neon3 4s ease infinite both' }} />
               <polygon points="418 1372.74 509 1539 928 781 1162.32 1211 1346 1211 923.1 456 418 1372.74" style={{ strokeWidth: 0, animation: 'neon2 4s ease infinite both' }} />
            </svg>
            <Box sx={{ position: 'absolute', bottom: '15px', width: '50%', height: '5px', background: 'rgba(0, 210, 255, 0.2)', borderRadius: '50%', filter: 'blur(5px)' }} />
          </Box>

          <Typography variant="h4" sx={{ fontWeight: 800, color: '#1e3a8a', mb: 2 }}>
            Đăng nhập
          </Typography>

          <Box component="form" onSubmit={handleSubmit} noValidate sx={{ width: '100%' }}>
            <Stack spacing={2}> {/* Giảm spacing nhẹ để ôm form hơn */}
              <FormControl fullWidth>
                <FormLabel sx={{ mb: 0.5, fontWeight: '600', color: '#1e293b', fontSize: '0.875rem' }}>
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
                    sx: { borderRadius: '12px', bgcolor: '#f8fafc' }
                  }}
                />
              </FormControl>

              <FormControl fullWidth>
                <FormLabel sx={{ mb: 0.5, fontWeight: '600', color: '#1e293b', fontSize: '0.875rem' }}>
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
                    sx: { borderRadius: '12px', bgcolor: '#f8fafc' }
                  }}
                />
              </FormControl>

              {/* <Button
                type="submit"
                fullWidth
                variant="contained"
                sx={{
                  mt: 1,
                  py: 1.5,
                  borderRadius: '12px',
                  fontWeight: '800',
                  textTransform: 'none',
                  backgroundImage: 'linear-gradient(45deg, #00d2ff, #3a7bd5)',
                  boxShadow: '0 4px 15px rgba(0, 210, 255, 0.3)',
                  '&:hover': { opacity: 0.9 }
                }}
              >
                Đăng nhập hệ thống
              </Button> */}


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

        <Typography variant="caption" sx={{ mt: 2, color: 'rgba(255,255,255,0.6)' }}>
          © All rights reserved.
        </Typography>
      </Container>
    </Box>
  );
};

export default LoginLayout;