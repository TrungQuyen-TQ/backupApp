import React, { useState, useEffect } from "react";
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Checkbox,
  Typography,
  Box,
  LinearProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  Chip,
  useTheme,
  Divider,
  TextField,
  InputAdornment,
  circularProgressClasses, CircularProgress,

} from "@mui/material";
import CloudIcon from "@mui/icons-material/Cloud";

const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
const MenuProps = {
  PaperProps: {
    style: {
      maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
      width: 250,
    },
  },
};

function getStyles(email, targetEmails, theme) {
  return {
    fontWeight: targetEmails.includes(email)
      ? theme.typography.fontWeightMedium
      : theme.typography.fontWeightRegular,
  };
}

const BackupManager = ({ onUpload, showMsg, isUploading, uploadSpeed,  }) => {
  const theme = useTheme();
  const [files, setFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState({});
  const [targetEmails, setTargetEmails] = useState([]);
  const [driveAccounts, setDriveAccounts] = useState([]);

  // Load dữ liệu khi component mount
  useEffect(() => {
    loadFiles();
    loadDriveAccounts();
    
    const removeProgress = window.electronAPI.onUploadProgress((data) => {
      setUploadStatus((prev) => ({
        ...prev,
        [data.fileName]: { ...prev[data.fileName], progress: data.progress, speed: data.speed },
      }));
    });

    const removeDone = window.electronAPI.onFileDone((data) => {
      setUploadStatus((prev) => ({
        ...prev,
        [data.fileName]: { ...prev[data.fileName], status: data.status, progress: 100 },
      }));
    });

    return () => {
      if (typeof removeProgress === 'function') removeProgress();
      if (typeof removeDone === 'function') removeDone();
    };
  }, []);

  const loadDriveAccounts = async () => {
    try {
      const result = await window.electronAPI.getDriveAccounts();
      if (result.success) setDriveAccounts(result.accounts);
    } catch (error) {
      console.error("Lỗi tải Drive:", error);
    }
  };

  const loadFiles = async () => {
    setIsLoading(true);
    try {
      const result = await window.electronAPI.getTempFiles();
      if (result.success) {
        setFiles(result.files);
        setSelectedFiles(result.files.map((file) => file.name));
      }
    } catch (error) {
      showMsg("Lỗi tải danh sách file", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = (fileName) => {
    const currentIndex = selectedFiles.indexOf(fileName);
    const newChecked = [...selectedFiles];
    if (currentIndex === -1) newChecked.push(fileName);
    else newChecked.splice(currentIndex, 1);
    setSelectedFiles(newChecked);
  };

  const handleToggleAll = () => {
    if (selectedFiles.length === files.length) setSelectedFiles([]);
    else setSelectedFiles(files.map((file) => file.name));
  };

  const handleEmailChange = (event) => {
    const { target: { value } } = event;
    setTargetEmails(typeof value === 'string' ? value.split(',') : value);
  };

  const handleUploadClick = () => {
    const filesToUpload = files.filter(f => selectedFiles.includes(f.name));
    onUpload(filesToUpload, targetEmails);
  };

  return (
    <Paper elevation={2} sx={{ width: '100%', borderRadius: 2, overflow: 'hidden' }}>
      <Box sx={{ p: 2, bgcolor: '#f8f9fa' }}>
        <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1a73e8' }}>
          Tải file Backup lên Google Drive
        </Typography>
      </Box>
      <Divider />

      <TableContainer sx={{ maxHeight: 400 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox" sx={{ bgcolor: '#fff' }}>
                <Checkbox
                  indeterminate={selectedFiles.length > 0 && selectedFiles.length < files.length}
                  checked={files.length > 0 && selectedFiles.length === files.length}
                  onChange={handleToggleAll}
                />
              </TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Tên file</TableCell>
              {/* CỘT MỚI: NGÀY GIỜ */}
              <TableCell sx={{ fontWeight: 'bold' }}>Ngày giờ</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold' }}>Dung lượng / Trạng thái</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {files.map((file) => {
              const status = uploadStatus[file.name];
              const isSelected = selectedFiles.includes(file.name);
              return (
                <React.Fragment key={file.name}>
                  <TableRow hover onClick={() => handleToggle(file.name)} selected={isSelected} sx={{ cursor: 'pointer' }}>
                    <TableCell padding="checkbox">
                      <Checkbox checked={isSelected} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>{file.name}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {file.mtime ? new Date(file.mtime).toLocaleString('vi-VN') : '---'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      {status?.status === "OK" ? (
                        <Typography variant="body2" color="success.main" sx={{ fontWeight: 'bold' }}>Hoàn tất ✓</Typography>
                      ) : status?.status === "Lỗi" ? (
                        <Typography variant="body2" color="error.main">Lỗi</Typography>
                      ) : (
                        <Typography variant="body2" color="text.secondary">{file.size}</Typography>
                      )}
                    </TableCell>
                  </TableRow>
                  {status && status.progress > 0 && status.progress < 100 && (
                    <TableRow>
                      <TableCell colSpan={4} sx={{ py: 0, borderBottom: 'none' }}>
                        <Box sx={{ px: 2, pb: 1 }}>
                          <LinearProgress variant="determinate" value={status.progress} sx={{ height: 4, borderRadius: 2 }} />
                          <Typography variant="caption" color="primary">{status.progress}% - {status.speed}</Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Divider />

      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <FormControl fullWidth size="small">
          <InputLabel>Chọn các Drive đích</InputLabel>
          <Select
            multiple
            value={targetEmails}
            onChange={handleEmailChange}
            input={<OutlinedInput label="Chọn các Drive đích" />}
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {selected.map((value) => (
                  <Chip key={value} label={value} size="small" color="primary" variant="outlined" />
                ))}
              </Box>
            )}
            MenuProps={MenuProps}
          >
            {driveAccounts.map((acc) => (
              <MenuItem key={acc.email} value={acc.email} style={getStyles(acc.email, targetEmails, theme)}>
                {acc.label} ({acc.email})
              </MenuItem>
            ))}
          </Select>
        </FormControl>

                  <Box>
            <Typography variant="subtitle2" sx={{ mb: 2, color: "#666" }}>
              Cấu hình và Giám sát Google Drive
            </Typography>

            {/* Nút bấm đẩy lên Drive di chuyển từ App.jsx sang */}
            <Button
              fullWidth
              onClick={onUpload}
              variant="contained"
              startIcon={
                isUploading ? (
                  <CircularProgress size={20} color="inherit" />
                ) : (
                  <CloudIcon />
                )
              }
              disabled={isLoading || isUploading}
              sx={{ py: 1.5, position: "relative", overflow: "hidden", mb: 2 }}
            >
              {isUploading
                ? `Đang tải lên (${uploadProgress}%)`
                : "Bắt đầu tải lên Drive"}
              {isUploading && (
                <LinearProgress
                  variant="determinate"
                  value={uploadProgress}
                  sx={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 4,
                  }}
                />
              )}
            </Button>

            {/* Ô Giám sát đường truyền di chuyển từ App.jsx sang */}
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
      </Box>
    </Paper>
  );
};

export default BackupManager;