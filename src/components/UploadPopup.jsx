import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Checkbox,
  Typography,
  CircularProgress,
  Box,
  ListItemButton,
  LinearProgress,
} from "@mui/material";

const UploadPopup = ({ open, onClose, onUpload, showMsg }) => {
  const [files, setFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Lưu trữ trạng thái upload: { fileName: { progress, speed, status } }
  const [uploadStatus, setUploadStatus] = useState({});

  useEffect(() => {
    if (open) {
      loadFiles();
      setUploadStatus({}); // Reset trạng thái khi mở lại popup
    }
  }, [open]);

  useEffect(() => {
  // 1. Lắng nghe tiến trình
  const removeProgress = window.electronAPI.onUploadProgress((data) => {
    setUploadStatus((prev) => ({
      ...prev,
      [data.fileName]: { 
        ...prev[data.fileName], 
        progress: data.progress, 
        speed: data.speed 
      },
    }));
  });

  // 2. Lắng nghe khi hoàn tất
  const removeDone = window.electronAPI.onFileDone((data) => {
    setUploadStatus((prev) => ({
      ...prev,
      [data.fileName]: { 
        ...prev[data.fileName], 
        status: data.status, 
        progress: 100 
      },
    }));
  });

  // HÀM CLEANUP ĐÃ SỬA
  return () => {
    if (typeof removeProgress === 'function') {
      removeProgress();
    }
    if (typeof removeDone === 'function') {
      removeDone();
    }
  };
}, []); // Chạy 1 lần duy nhất khi mount

  const loadFiles = async () => {
    setIsLoading(true);
    try {
      const result = await window.electronAPI.getTempFiles();
      if (result.success) {
        setFiles(result.files);
        setSelectedFiles(result.files.map((file) => file.name));
      } else {
        showMsg("Lỗi tải danh sách file backup: " + result.error, "error");
      }
    } catch (error) {
      showMsg("Lỗi hệ thống khi tải file: " + error.message, "error");
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

  const handleUploadClick = async () => {
    if (selectedFiles.length === 0) {
      showMsg("Vui lòng chọn ít nhất 1 file để upload.", "warning");
      return;
    }
    const filesToUpload = files.filter(file => selectedFiles.includes(file.name));
    onUpload(filesToUpload);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Tải file Backup lên Google Drive</DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : files.length === 0 ? (
          <Typography color="text.secondary" align="center" sx={{ py: 3 }}>
            Không có file backup nào trong thư mục temp.
          </Typography>
        ) : (
          <List sx={{ width: '100%', bgcolor: 'background.paper', py: 0 }}>
            <ListItem dense sx={{ borderBottom: '1px solid #eee' }}>
              <ListItemButton onClick={handleToggleAll}>
                <ListItemIcon>
                  <Checkbox
                    edge="start"
                    checked={selectedFiles.length === files.length && files.length > 0}
                    indeterminate={selectedFiles.length > 0 && selectedFiles.length < files.length}
                    disableRipple
                  />
                </ListItemIcon>
                <ListItemText primary={<Typography variant="subtitle2">Chọn tất cả</Typography>} />
              </ListItemButton>
            </ListItem>

            {files.map((file) => {
              const status = uploadStatus[file.name];
              const isDone = status?.status === "OK";
              const isError = status?.status === "Lỗi";

              return (
                <React.Fragment key={file.name}>
                  <ListItem
                    disablePadding
                    secondaryAction={
                      <Box sx={{ textAlign: 'right', mr: 1 }}>
                        {isDone ? (
                          <Typography variant="body2" color="success.main" sx={{ fontWeight: 'bold' }}>
                            Hoàn tất ✓
                          </Typography>
                        ) : isError ? (
                          <Typography variant="body2" color="error.main">Lỗi</Typography>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            {file.size}
                          </Typography>
                        )}
                      </Box>
                    }
                  >
                    <ListItemButton onClick={() => handleToggle(file.name)} dense sx={{ pr: 12 }}>
                      <ListItemIcon>
                        <Checkbox
                          edge="start"
                          checked={selectedFiles.includes(file.name)}
                          disableRipple
                        />
                      </ListItemIcon>
                      <ListItemText
                        primary={file.name}
                        primaryTypographyProps={{ noWrap: true, variant: 'body2' }}
                        secondary={
                          status && !isDone && !isError ? (
                            <Typography variant="caption" color="primary">
                              {status.progress}% - {status.speed}
                            </Typography>
                          ) : null
                        }
                      />
                    </ListItemButton>
                  </ListItem>
                  {/* Hiển thị thanh Progress bar khi đang upload */}
                  {status && status.progress > 0 && status.progress < 100 && (
                    <LinearProgress 
                      variant="determinate" 
                      value={status.progress} 
                      sx={{ height: 2, mx: 2, mb: 1 }} 
                    />
                  )}
                </React.Fragment>
              );
            })}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">Hủy</Button>
        <Button
          onClick={handleUploadClick}
          variant="contained"
          disabled={isLoading || selectedFiles.length === 0}
        >
          Tải lên ({selectedFiles.length})
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default UploadPopup;