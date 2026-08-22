import React from "react";
import { Modal, Box, Typography, Button, Backdrop, Fade } from "@mui/material";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";

const ConfirmDeleteModal = ({ open, onClose, onConfirm, title, description, confirmText }) => {
  return (
    <Modal
      open={open}
      onClose={onClose}
      disableEnforceFocus
      disableRestoreFocus
      closeAfterTransition
      slots={{ backdrop: Backdrop }}
      slotProps={{
        backdrop: {
          sx: { 
            backgroundColor: 'rgba(15, 23, 42, 0.4)', 
            backdropFilter: 'blur(8px)',
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
          }
        }
      }}
    >
      <Fade in={open}>
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: { xs: "90%", sm: 420 },
            bgcolor: "background.paper",
            borderRadius: "28px",
            boxShadow: "0 20px 40px -12px rgba(0, 0, 0, 0.3)",
            p: 4,
            textAlign: "center",
            outline: "none",
            border: "1px solid rgba(255, 255, 255, 0.1)",
          }}
        >
          {/* Icon Section */}
          <Box 
            sx={{ 
              width: 80, height: 80, bgcolor: "#fff1f0", borderRadius: "24px", 
              display: "flex", alignItems: "center", justifyContent: "center", 
              margin: "0 auto 24px", color: "#ef4444",
              transform: "rotate(-10deg)",
              boxShadow: "0 10px 20px rgba(239, 68, 68, 0.15)",
              transition: "transform 0.3s ease",
              "&:hover": { transform: "rotate(0deg) scale(1.05)" }
            }}
          >
            <DeleteSweepIcon sx={{ fontSize: 45 }} />
          </Box>

          <Typography variant="h5" sx={{ fontWeight: 900, mb: 1.5, color: "#0f172a", letterSpacing: "-0.5px" }}>
            {title || "Xác nhận xóa?"}
          </Typography>
          
          <Typography variant="body1" sx={{ color: "#64748b", mb: 4, lineHeight: 1.6, px: 2 }}>
            {description || "Hành động này không thể hoàn tác. Bạn có chắc chắn muốn tiếp tục?"}
          </Typography>

          <Box sx={{ display: "flex", gap: 2 }}>
            <Button
              fullWidth
              onClick={onClose}
              sx={{ 
                borderRadius: "16px", fontWeight: 700, textTransform: "none",
                py: 1.5, bgcolor: "#f8fafc", color: "#64748b",
                border: "1px solid #e2e8f0",
                "&:hover": { bgcolor: "#f1f5f9", borderColor: "#cbd5e1" },
                transition: "all 0.2s"
              }}
            >
              Hủy bỏ
            </Button>

            <Button
              fullWidth
              variant="contained"
              onClick={() => {
                onConfirm();
                onClose();
              }}
              sx={{
                borderRadius: "16px", fontWeight: 800, textTransform: "none", py: 1.5,
                background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                boxShadow: "0 8px 16px -4px rgba(239, 68, 68, 0.4)",
                "&:hover": { 
                  background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
                  transform: "translateY(-2px)",
                  boxShadow: "0 12px 20px -4px rgba(239, 68, 68, 0.5)",
                },
                transition: "all 0.2s"
              }}
            >
              {confirmText || "Xóa ngay"}
            </Button>
          </Box>
        </Box>
      </Fade>
    </Modal>
  );
};

export default ConfirmDeleteModal;
