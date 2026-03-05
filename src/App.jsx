import React, { useState } from "react";
import { Box, Snackbar, Alert } from "@mui/material";

// Import các trang thành phần
import LoginLayout from "./pages/Login/loginPage";
import DashboardPage from "./pages/DashboardPage";

function App() {
  // Quản lý trạng thái đăng nhập
  const [isLoggedIn, setIsLoggedIn] = useState(true);

  // Quản lý trạng thái thông báo (Snackbar)
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success", // success, error, warning, info
  });

    const showMsg = (msg, type = "success") => {
    setSnackbar({ open: true, message: msg, severity: type });
  };

  /**
   * Logic xử lý đăng nhập
   * Bạn có thể thay đổi logic này để kiểm tra qua electronAPI
   */
  const handleLogin = (username, password) => {
    // Giả lập kiểm tra tài khoản đơn giản cho Desktop App
    if (username === "admin" && password === "123") {
      setIsLoggedIn(true);
      showMsg("Đăng nhập thành công!", "success");
    } else {
      showMsg("Tài khoản hoặc mật khẩu không chính xác", "error");
    }
  };

  /**
   * Hàm đóng Snackbar
   */
  const handleCloseSnackbar = (event, reason) => {
    if (reason === 'clickaway') return;
    setSnackbar({ ...snackbar, open: false });
  };

  return (
    <Box 
      sx={{ 
        bgcolor: "#fff", 
        minHeight: "100vh",
        display:"flex",
        userSelect: "none", 
        justifyContent:"center",
        alignItems:"center",
        margin:"0",
      }}
    >
      {/* ĐIỀU HƯỚNG TRANG:
          Nếu chưa đăng nhập hiển thị Login, ngược lại hiển thị Dashboard
      */}
      {!isLoggedIn ? (
        <LoginLayout onLogin={handleLogin} />
      ) : (
        <DashboardPage showMsg={showMsg} />
      )}

      {/* THÀNH PHẦN THÔNG BÁO (SNACKBAR) DÙNG CHUNG:
          Được đặt ở App.js để hiển thị đè lên tất cả các trang
      */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbar.severity} 
          variant="filled" 
          elevation={6}
          sx={{ width: '100%', borderRadius: '8px' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default App;