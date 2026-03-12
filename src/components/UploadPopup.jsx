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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  Chip,
  useTheme, // Đảm bảo đã import
} from "@mui/material";

// ĐƯA CÁC HẰNG SỐ LÊN ĐẦU FILE
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

const UploadPopup = ({ open, onClose, onUpload, showMsg }) => {
  const theme = useTheme(); // KHỞI TẠO THEME Ở ĐÂY
  const [files, setFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState({});
  
  // KHỞI TẠO LÀ MẢNG RỖNG [] thay vì chuỗi rỗng ""
  const [targetEmails, setTargetEmails] = useState([]); 
  const [driveAccounts, setDriveAccounts] = useState([]);

  useEffect(() => {
    if (open) {
      loadFiles();
      loadDriveAccounts();
      setUploadStatus({});
    }
  }, [open]);

  useEffect(() => {
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

    return () => {
      if (typeof removeProgress === 'function') removeProgress();
      if (typeof removeDone === 'function') removeDone();
    };
  }, []);

  const loadDriveAccounts = async () => {
    try {
      const result = await window.electronAPI.getDriveAccounts();
      if (result.success) {
        setDriveAccounts(result.accounts);
      }
    } catch (error) {
      console.error("Lỗi tải danh sách Drive:", error);
    }
  };

  const handleEmailChange = (event) => {
    const { target: { value } } = event;
    setTargetEmails(typeof value === 'string' ? value.split(',') : value);
  };

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

  const handleUploadClick = () => {
    if (selectedFiles.length === 0) {
      showMsg("Vui lòng chọn ít nhất 1 file để upload.", "warning");
      return;
    }
    if (targetEmails.length === 0) {
      showMsg("Vui lòng chọn ít nhất 1 Drive đích!", "warning");
      return;
    }
    const filesToUpload = files.filter(f => selectedFiles.includes(f.name));
    onUpload(filesToUpload, targetEmails); 
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 'bold' }}>Tải file Backup lên Google Drive</DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          <List sx={{ width: '100%', bgcolor: 'background.paper', py: 0 }}>
            <ListItem dense sx={{ borderBottom: '1px solid #eee' }}>
              <ListItemButton onClick={handleToggleAll}>
                <ListItemIcon>
                  <Checkbox
                    edge="start"
                    checked={selectedFiles.length === files.length && files.length > 0}
                    indeterminate={selectedFiles.length > 0 && selectedFiles.length < files.length}
                  />
                </ListItemIcon>
                <ListItemText primary={<Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>Chọn tất cả</Typography>} />
              </ListItemButton>
            </ListItem>
            {files.map((file) => {
              const status = uploadStatus[file.name];
              return (
                <React.Fragment key={file.name}>
                  <ListItem
                    disablePadding
                    secondaryAction={
                      <Box sx={{ textAlign: 'right', mr: 1 }}>
                        {status?.status === "OK" ? (
                          <Typography variant="body2" color="success.main" sx={{ fontWeight: 'bold' }}>Hoàn tất ✓</Typography>
                        ) : status?.status === "Lỗi" ? (
                          <Typography variant="body2" color="error.main">Lỗi</Typography>
                        ) : (
                          <Typography variant="body2" color="text.secondary">{file.size}</Typography>
                        )}
                      </Box>
                    }
                  >
                    <ListItemButton onClick={() => handleToggle(file.name)} dense>
                      <ListItemIcon>
                        <Checkbox edge="start" checked={selectedFiles.includes(file.name)} />
                      </ListItemIcon>
                      <ListItemText
                        primary={file.name}
                        secondary={status && status.status !== "OK" ? `${status.progress}% - ${status.speed}` : null}
                      />
                    </ListItemButton>
                  </ListItem>
                  {status && status.progress > 0 && status.progress < 100 && (
                    <LinearProgress variant="determinate" value={status.progress} sx={{ height: 2, mx: 2, mb: 1 }} />
                  )}
                </React.Fragment>
              );
            })}
          </List>
        )}
      </DialogContent>
      
      <DialogActions sx={{ flexDirection: 'column', p: 2, gap: 1.5 }}>
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

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', width: '100%', gap: 1 }}>
          <Button onClick={onClose} color="inherit">Hủy</Button>
          <Button 
            onClick={handleUploadClick}
            disabled={selectedFiles.length === 0 || targetEmails.length === 0}
            variant="contained"
          >
            TẢI LÊN ({selectedFiles.length})
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default UploadPopup;