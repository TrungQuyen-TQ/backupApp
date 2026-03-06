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
  FormLabel
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';

const LoginLayout = ({ onLogin }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleClickShowPassword = () => setShowPassword((show) => !show);

  const handleSubmit = (event) => {
    event.preventDefault();
    onLogin(username, password);
  };

  return (
    <Container maxWidth="sm">
      <Box 
        sx={{ 
          marginTop: 8, 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center',
          boxShadow: 3,
          p: 4,
          borderRadius: 2
        }}
      >
        {/* Logo Placeholder */}
        <Box sx={{ mb: 4, width: '30%', textAlign: 'center' }}>
          
        </Box>

        <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 1, width: '100%' }}>
          <Stack spacing={3}>
            
            {/* Trường Tên đăng nhập */}
            <FormControl fullWidth>
              <FormLabel sx={{ mb: 1, fontWeight: '500', color: 'text.primary' }}>
                Tên đăng nhập
              </FormLabel>
              <TextField
                required
                fullWidth
                id="username"
                name="username"
                placeholder="Nhập tên đăng nhập"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                error={username === ""} // Giả lập trạng thái lỗi như trong HTML của bạn
                helperText={username === "" ? "Vui lòng cung cấp tên đăng nhập" : ""}
              />
            </FormControl>

            {/* Trường Mật khẩu */}
            <FormControl fullWidth>
              <FormLabel sx={{ mb: 1, fontWeight: '500', color: 'text.primary' }}>
                Mật khẩu
              </FormLabel>
              <TextField
                fullWidth
                name="password"
                type={showPassword ? 'text' : 'password'}
                id="password"
                placeholder="Nhập mật khẩu"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle password visibility"
                        onClick={handleClickShowPassword}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </FormControl>

            {/* Nút Đăng nhập */}
            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              sx={{ 
                mt: 2, 
                py: 1.5,
                textTransform: 'none',
                fontSize: '1rem',
                fontWeight: 'bold'
              }}
            >
              Đăng nhập
            </Button>
          </Stack>
        </Box>
      </Box>
    </Container>
  );
};

export default LoginLayout;