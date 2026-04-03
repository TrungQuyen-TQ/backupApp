import React from "react";
import { Modal, Box, Typography, Button, Backdrop } from "@mui/material";
import ErrorIcon from "@mui/icons-material/Error";

const ConfirmStopModal = ({ open, onClose, onConfirm }) => {
  return (
    <Modal
      open={open}
      onClose={onClose}
      closeAfterTransition
      slots={{ backdrop: Backdrop }}
      slotProps={{
        backdrop: {
          sx: { 
            backgroundColor: 'rgba(0, 0, 0, 0.2)', 
            backdropFilter: 'blur(6px)', // Hiệu ứng làm mờ nền cao cấp
            transition: 'all 0.3s'
          }
        }
      }}
    >
      <Box
        sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: { xs: "90%", sm: 400 },
          bgcolor: "background.paper",
          borderRadius: "24px", // Bo góc lớn hiện đại
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          p: 4,
          textAlign: "center",
          outline: "none",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          animation: "modalFadeIn 0.3s ease-out",
          "@keyframes modalFadeIn": {
            "0%": { opacity: 0, transform: "translate(-50%, -45%) scale(0.95)" },
            "100%": { opacity: 1, transform: "translate(-50%, -50%) scale(1)" }
          }
        }}
      >
        {/* Icon cảnh báo phát sáng */}
        <Box 
          sx={{ 
            width: 70, height: 70, bgcolor: "#fff1f0", borderRadius: "50%", 
            display: "flex", alignItems: "center", justifyContent: "center", 
            margin: "0 auto 20px", color: "#ef4444",
            boxShadow: "0 0 20px rgba(239, 68, 68, 0.2)"
          }}
        >
          <ErrorIcon sx={{ fontSize: 45 }} />
        </Box>

        <Typography variant="h6" sx={{ fontWeight: 800, mb: 1, color: "#1a2027", letterSpacing: "-0.5px" }}>
          Xác nhận dừng Backup?
        </Typography>
        
        <Typography variant="body2" sx={{ color: "#64748b", mb: 4, lineHeight: 1.6 }}>
          Hành động này sẽ ngắt kết nối SSH và hủy bỏ tiến trình đang chạy. Dữ liệu tạm trên server có thể sẽ bị xóa.
        </Typography>

        <Box sx={{ display: "flex", gap: 2 }}>
          <Button
            fullWidth
            onClick={onClose}
            sx={{ 
              borderRadius: "14px", fontWeight: 700, textTransform: "none",
              py: 1.2, bgcolor: "#f1f5f9", color: "#475569",
              "&:hover": { bgcolor: "#e2e8f0", transform: "translateY(-1px)" },
              transition: "all 0.2s"
            }}
          >
            Quay lại
          </Button>

          <Button
            fullWidth
            variant="contained"
            onClick={onConfirm}
            sx={{
              borderRadius: "14px", fontWeight: 800, textTransform: "none", py: 1.2,
              background: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)",
              boxShadow: "0 10px 15px -3px rgba(239, 68, 68, 0.3)",
              "&:hover": { 
                transform: "translateY(-2px)", 
                boxShadow: "0 15px 20px -3px rgba(239, 68, 68, 0.4)",
                filter: "brightness(1.1)" 
              },
              transition: "all 0.2s"
            }}
          >
            Dừng ngay
          </Button>
        </Box>
      </Box>
    </Modal>
  );
};

export default ConfirmStopModal;