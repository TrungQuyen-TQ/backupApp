import React, { useState } from "react";
import {
  Box,
  Typography,
  CircularProgress,
  TextField,
  InputAdornment,
  LinearProgress,
} from "@mui/material";
import CloudIcon from "@mui/icons-material/Cloud";

export const CloudBackup = ({
  handleOpenUploadPopup,
  isUploading,
  uploadProgress,
  uploadSpeed,
  isLoading,
}) => {
  const [cloudSubTab, setCloudSubTab] = useState(0);

  return (
    <Box sx={{ p: 0 }}>
      <Box sx={{ p: 2 }}>
        {/* NỘI DUNG GOOGLE DRIVE */}
        {cloudSubTab === 0 && (
          <Box>
            {/* --- PHẦN MỚI: HIỂN THỊ TIẾN TRÌNH % --- */}
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: "bold", color: isUploading ? "#1976d2" : "#757575" }}>
                  {isUploading ? "Tiến trình tải lên" : "Sẵn sàng đẩy bản ghi"}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: "bold", color: "#1976d2" }}>
                  {uploadProgress}%
                </Typography>
              </Box>
              
              <LinearProgress
                variant="determinate"
                value={uploadProgress}
                sx={{
                  height: 10,
                  borderRadius: 5,
                  bgcolor: "#e0e0e0",
                  "& .MuiLinearProgress-bar": {
                    borderRadius: 5,
                    backgroundImage: isUploading 
                      ? "linear-gradient(45deg, #1976d2 30%, #64b5f6 90%)" 
                      : "none",
                  },
                }}
              />
            </Box>
            {/* -------------------------------------- */}

            <TextField
              fullWidth
              label="Tốc độ đường truyền"
              size="small"
              variant="outlined"
              value={isUploading ? uploadSpeed : "Hệ thống sẵn sàng"}
              InputProps={{
                readOnly: true,
                startAdornment: (
                  <InputAdornment position="start">
                    <CloudIcon
                      sx={{
                        color: isUploading ? "#1976d2" : "#b0bec5",
                        animation: isUploading ? "pulse 1.5s infinite" : "none",
                        "@keyframes pulse": {
                          "0%": { opacity: 1 },
                          "50%": { opacity: 0.4 },
                          "100%": { opacity: 1 },
                        },
                      }}
                    />
                  </InputAdornment>
                ),
                sx: {
                  fontFamily: "'JetBrains Mono', monospace",
                  bgcolor: isUploading ? "#f0f7ff" : "#fafafa",
                  fontWeight: "bold",
                  fontSize: "0.9rem",
                  color: isUploading ? "#1976d2" : "#607d8b",
                  "& fieldset": {
                    borderColor: isUploading ? "#1976d2 !important" : "#e0e0e0",
                    borderWidth: isUploading ? "2px" : "1px",
                  },
                },
              }}
              helperText={
                <Box
                  component="span"
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5,
                    fontWeight: 500,
                  }}
                >
                  {isUploading ? (
                    <>
                      <CircularProgress size={10} thickness={6} />
                      <span style={{ color: "#1976d2" }}>
                        Đang đẩy dữ liệu lên Google Drive...
                      </span>
                    </>
                  ) : (
                    "Trạng thái: Nhàn rỗi"
                  )}
                </Box>
              }
            />
          </Box>
        )}

        {/* NỘI DUNG AWS S3 */}
        {cloudSubTab === 1 && (
          <Box sx={{ textAlign: "center", py: 4 }}>
            <Typography color="textSecondary">
              Tính năng AWS S3 sẽ sớm ra mắt...
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};