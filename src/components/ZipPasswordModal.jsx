import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  IconButton,
  InputAdornment,
  Alert,
} from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import KeyIcon from "@mui/icons-material/Key";

export function ZipPasswordModal({ open, onClose, showMsg }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setErrorMsg("");
      setNewPassword("");
      setConfirmPassword("");
      fetchCurrentPassword();
    }
  }, [open]);

  const fetchCurrentPassword = async () => {
    try {
      if (window.electronAPI?.getZipPassword) {
        const res = await window.electronAPI.getZipPassword();
        if (res.success) {
          setCurrentPassword(res.password || "");
        }
      }
    } catch (e) {
      console.warn("Lỗi đọc mật khẩu Zip:", e);
    }
  };

  const handleSave = async () => {
    setErrorMsg("");

    if (!newPassword) {
      setErrorMsg("Vui lòng nhập mật khẩu Zip mới!");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg("Mật khẩu xác nhận không khớp! Vui lòng kiểm tra lại.");
      return;
    }

    setIsLoading(true);
    try {
      if (window.electronAPI?.saveZipPassword) {
        const res = await window.electronAPI.saveZipPassword(newPassword);
        if (res.success) {
          if (showMsg) showMsg("✅ Đã cập nhật mật khẩu nén Zip thành công!", "success");
          setCurrentPassword(newPassword);
          onClose();
        } else {
          setErrorMsg(res.error || "Không thể lưu mật khẩu mới!");
        }
      }
    } catch (e) {
      setErrorMsg("Lỗi hệ thống: " + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: "16px",
          p: 1,
          boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
        },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          fontWeight: 800,
          color: "#1e293b",
          pb: 1,
        }}
      >
        <KeyIcon sx={{ color: "#00d2ff", fontSize: 28 }} />
        Cài Đặt Mật Khẩu Nén Zip / 7z
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Mật khẩu này được dùng để mã hóa và đặt mật khẩu bảo vệ cho tất cả các file nén backup (.7z) sinh ra.
        </Typography>

        {errorMsg && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: "10px" }}>
            {errorMsg}
          </Alert>
        )}

        <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
          {/* Display Current Password info */}
          <TextField
            label="Mật khẩu hiện tại"
            variant="outlined"
            size="small"
            value={currentPassword || "(Đang dùng mặc định: admin123)"}
            disabled
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LockIcon sx={{ color: "#94a3b8" }} />
                </InputAdornment>
              ),
            }}
          />

          {/* New Password */}
          <TextField
            label="Mật khẩu nén mới"
            variant="outlined"
            size="small"
            type={showNewPassword ? "text" : "password"}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            fullWidth
            placeholder="Nhập mật khẩu mới..."
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <KeyIcon sx={{ color: "#00d2ff" }} />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    edge="end"
                  >
                    {showNewPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          {/* Confirm New Password */}
          <TextField
            label="Xác nhận mật khẩu mới"
            variant="outlined"
            size="small"
            type={showConfirmPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            fullWidth
            placeholder="Nhập lại mật khẩu mới..."
            error={Boolean(confirmPassword && newPassword !== confirmPassword)}
            helperText={
              confirmPassword && newPassword !== confirmPassword
                ? "❌ Mật khẩu xác nhận không khớp"
                : ""
            }
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <KeyIcon sx={{ color: confirmPassword && newPassword !== confirmPassword ? "#ef4444" : "#00d2ff" }} />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    edge="end"
                  >
                    {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button
          onClick={onClose}
          sx={{
            borderRadius: "10px",
            px: 3,
            color: "#64748b",
            fontWeight: 700,
          }}
        >
          HỦY
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={isLoading || !newPassword || newPassword !== confirmPassword}
          sx={{
            borderRadius: "10px",
            px: 3,
            fontWeight: 800,
            background: "linear-gradient(135deg, #00d2ff 0%, #3a7bd5 100%)",
            boxShadow: "0 4px 15px rgba(0, 210, 255, 0.4)",
            "&:hover": {
              background: "linear-gradient(135deg, #00b4db 0%, #2b5876 100%)",
            },
          }}
        >
          {isLoading ? "ĐANG LƯU..." : "LƯU MẬT KHẨU"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
