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
} from "@mui/material";

const UploadPopup = ({ open, onClose, onUpload, showMsg }) => {
  const [files, setFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadFiles();
    }
  }, [open]);

  const loadFiles = async () => {
    setIsLoading(true);
    try {
      const result = await window.electronAPI.getTempFiles();
      if (result.success) {
        setFiles(result.files);
        // By default, select all files
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

    if (currentIndex === -1) {
      newChecked.push(fileName);
    } else {
      newChecked.splice(currentIndex, 1);
    }

    setSelectedFiles(newChecked);
  };

  const handleToggleAll = () => {
    if (selectedFiles.length === files.length) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(files.map((file) => file.name));
    }
  };

  const handleUploadClick = async () => {
    if (selectedFiles.length === 0) {
      showMsg("Vui lòng chọn ít nhất 1 file để upload.", "warning");
      return;
    }

    // Pass selected files and their paths back to parent
    const filesToUpload = files.filter(file => selectedFiles.includes(file.name));
    onUpload(filesToUpload);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Tải file Backup lên Google Drive</DialogTitle>
      <DialogContent dividers>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : files.length === 0 ? (
          <Typography color="text.secondary" align="center" sx={{ py: 3 }}>
            Không có file backup nào trong thư mục temp.
          </Typography>
        ) : (
          <List sx={{ width: '100%', bgcolor: 'background.paper' }}>
            <ListItem
              dense
              button
              onClick={handleToggleAll}
              sx={{ borderBottom: '1px solid #eee', mb: 1 }}
            >
              <ListItemIcon>
                <Checkbox
                  edge="start"
                  checked={selectedFiles.length === files.length && files.length > 0}
                  indeterminate={selectedFiles.length > 0 && selectedFiles.length < files.length}
                  tabIndex={-1}
                  disableRipple
                />
              </ListItemIcon>
              <ListItemText primary={<Typography variant="subtitle2">Chọn tất cả</Typography>} />
            </ListItem>

            {/* Thay thế đoạn map cũ bằng đoạn này */}
            {files.map((file) => {
              const labelId = `checkbox-list-label-${file.name}`;
              return (
                <ListItem
                  key={file.name}
                  disablePadding
                  // secondaryAction sẽ được render bên trong ListItem nhưng ngoài ListItemButton
                  secondaryAction={
                    <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                      {file.size}
                    </Typography>
                  }
                >
                  <ListItemButton
                    onClick={() => handleToggle(file.name)}
                    dense
                    sx={{ pr: 8 }} // Tạo khoảng trống bên phải để không đè lên secondaryAction
                  >
                    <ListItemIcon>
                      <Checkbox
                        edge="start"
                        checked={selectedFiles.indexOf(file.name) !== -1}
                        tabIndex={-1}
                        disableRipple
                        inputProps={{ 'aria-labelledby': labelId }}
                      />
                    </ListItemIcon>
                    <ListItemText
                      id={labelId}
                      primary={file.name}
                      primaryTypographyProps={{ noWrap: true }} // Tránh tràn chữ nếu tên file quá dài
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Hủy
        </Button>
        <Button
          onClick={handleUploadClick}
          variant="contained"
          disabled={isLoading || selectedFiles.length === 0}
        >
          Tải lên Drive ({selectedFiles.length})
        </Button>
      </DialogActions>
    </Dialog>
  );
};
export default UploadPopup;