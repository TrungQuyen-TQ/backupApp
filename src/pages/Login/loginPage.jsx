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
        // Nền Gradient hiện đại cho Desktop App
        background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 50%, #93c5fd 100%)',
        p: 2
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
              width: 60,
              height: 60,
              bgcolor: 'primary.main',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 2,
              boxShadow: '0 8px 16px rgba(59, 130, 246, 0.4)',
              background: 'linear-gradient(45deg, #2563eb, #60a5fa)'
            }}
          >
            <LockOutlined sx={{ color: '#fff', fontSize: 32 }} />
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
                  borderRadius: '12px',
                  textTransform: 'none',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  background: 'linear-gradient(45deg, #1e40af, #3b82f6)',
                  boxShadow: '0 10px 20px rgba(59, 130, 246, 0.3)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 12px 24px rgba(59, 130, 246, 0.4)',
                    background: 'linear-gradient(45deg, #1d4ed8, #2563eb)',
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