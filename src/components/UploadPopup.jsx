import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Checkbox,
  Typography,
  CircularProgress,
  ListItemButton,
  LinearProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  Chip,
  useTheme,
} from "@mui/material";

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

const UploadPanel = ({ onUpload, showMsg, formdata }) => {
  const theme = useTheme();
  const [files, setFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState({});
  const [targetEmails, setTargetEmails] = useState([]);
  const [driveAccounts, setDriveAccounts] = useState([]);
  const [uploadTarget, setUploadTarget] = useState("drive");

  useEffect(() => {
    loadFiles();
    loadDriveAccounts();
    setUploadStatus({});
  }, []);

  useEffect(() => {
    const removeProgress = window.electronAPI.onUploadProgress((data) => {
      setUploadStatus((prev) => ({
        ...prev,
        [data.fileName]: {
          ...prev[data.fileName],
          progress: data.progress,
          speed: data.speed,
        },
      }));
    });

    const removeDone = window.electronAPI.onFileDone((data) => {
      setUploadStatus((prev) => ({
        ...prev,
        [data.fileName]: {
          ...prev[data.fileName],
          status: data.status,
          progress: 100,
        },
      }));
    });

    return () => {
      if (typeof removeProgress === "function") removeProgress();
      if (typeof removeDone === "function") removeDone();
    };
  }, []);

  const loadDriveAccounts = async () => {
    try {
      const result = await window.electronAPI.getDriveAccounts();
      if (result.success) setDriveAccounts(result.accounts);
    } catch (error) {
      console.error(error);
    }
  };

  const handleEmailChange = (event) => {
    const { value } = event.target;
    setTargetEmails(typeof value === "string" ? value.split(",") : value);
  };

  const loadFiles = async () => {
    setIsLoading(true);
    try {
      const result = await window.electronAPI.getTempFiles(formdata.localPath);
      if (result.success) {
        setFiles(result.files);
        setSelectedFiles(result.files.map((f) => f.name));
      } else {
        showMsg(result.error, "error");
      }
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
    else setSelectedFiles(files.map((f) => f.name));
  };

  const handleUploadClick = async () => { // SỬA: Thêm async ở đây
    if (selectedFiles.length === 0) return showMsg("Vui lòng chọn ít nhất 1 file", "warning");
    if (uploadTarget === "drive" && targetEmails.length === 0) return showMsg("Vui lòng chọn Drive đích", "warning");

    const filesToUpload = files.filter((f) => selectedFiles.includes(f.name));
    
    // 1. Chờ quá trình upload hoàn tất (onUpload cần là một async function từ App.jsx)
    try {
      setIsLoading(true); // Hiển thị loading trong khi chờ dọn dẹp
      await onUpload(filesToUpload, targetEmails);
      
      // 2. Sau khi upload và server xóa file xong, ta gọi lại loadFiles để cập nhật UI
      // Thêm một chút delay nhỏ (khoảng 500ms) để đảm bảo ổ cứng đã kịp cập nhật trạng thái xóa
      setTimeout(async () => {
        await loadFiles();
        showMsg("Đã dọn dẹp danh sách file thành công", "success");
      }, 1000);

    } catch (error) {
      showMsg("Lỗi trong quá trình xử lý sau upload", "error");
    } finally {
      // Logic setIsLoading(false) sẽ nằm trong loadFiles nên không cần ở đây
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: "bold" }}></Typography>

      {isLoading ? (
        <CircularProgress />
      ) : (
        <List>
          {/* Header */}
          <ListItem sx={{ borderBottom: "1px solid #eee" }}>
            <ListItemIcon>
              <Checkbox
                checked={
                  selectedFiles.length === files.length && files.length > 0
                }
                indeterminate={
                  selectedFiles.length > 0 &&
                  selectedFiles.length < files.length
                }
                onChange={handleToggleAll}
              />
            </ListItemIcon>
            <ListItemText primary="Tên file" />
            <Typography sx={{ width: 120 }}>Ngày</Typography>
            <Typography sx={{ width: 100 }}>Size</Typography>
          </ListItem>

          {files.map((file) => {
            const status = uploadStatus[file.name];

            return (
              <React.Fragment key={file.name}>
                <ListItem>
                  <ListItemIcon>
                    <Checkbox
                      checked={selectedFiles.includes(file.name)}
                      onChange={() => handleToggle(file.name)}
                    />
                  </ListItemIcon>

                  <ListItemText primary={file.name} />

                  {/* CỘT NGÀY */}
                  <Typography sx={{ width: 120 }}>
                    {file.createdAt
                      ? new Date(file.createdAt).toLocaleDateString()
                      : "-"}
                  </Typography>

                  <Typography sx={{ width: 100 }}>
                    {status?.status === "OK" ? "✓" : file.size}
                  </Typography>
                </ListItem>

                {status && status.progress > 0 && status.progress < 100 && (
                  <LinearProgress
                    value={status.progress}
                    variant="determinate"
                  />
                )}
              </React.Fragment>
            );
          })}
        </List>
      )}

      <Box sx={{ mt: 2 }}>
        <FormControl fullWidth size="small">
          <InputLabel>Đích upload</InputLabel>
          <Select
            value={uploadTarget}
            onChange={(e) => setUploadTarget(e.target.value)}
            input={<OutlinedInput label="Đích upload" />}
          >
            <MenuItem value="drive">Google Drive</MenuItem>
            <MenuItem value="aws">AWS S3</MenuItem>
            <MenuItem value="ftp">FTP</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {uploadTarget === "drive" ? (
        <Box sx={{ mt: 2 }}>
          <FormControl fullWidth size="small">
            <InputLabel>Drive</InputLabel>
            <Select
              multiple
              value={targetEmails}
              onChange={handleEmailChange}
              input={<OutlinedInput label="Drive" />}
              renderValue={(selected) => (
                <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                  {selected.map((v) => (
                    <Chip key={v} label={v} size="small" />
                  ))}
                </Box>
              )}
              MenuProps={MenuProps}
            >
              {driveAccounts.map((acc) => (
                <MenuItem
                  key={acc.email}
                  value={acc.email}
                  style={getStyles(acc.email, targetEmails, theme)}
                >
                  {acc.label} ({acc.email})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      ) : (
        <Typography
          sx={{ mt: 2, color: "text.secondary", fontStyle: "italic" }}
        >
          Tính năng này đang phát triển...
        </Typography>
      )}
      <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end", gap: 1 }}>
        <Button variant="contained" onClick={handleUploadClick}>
          Upload ({selectedFiles.length})
        </Button>
      </Box>
    </Box>
  );
};

export default UploadPanel;
