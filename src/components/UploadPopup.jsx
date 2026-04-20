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
  Skeleton, // <--- THÊM CHỮ NÀY VÀO ĐÂY
  LinearProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  Chip,
  useTheme,
  TextField,
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
  // 1. Thêm state mới (Đặt giá trị mặc định là SQL_Backups)
  const [folderName, setFolderName] = useState("SQL_Backups");



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

  const [isDriveError, setIsDriveError] = useState(false);

  const handleUploadClick = async () => { // SỬA: Thêm async ở đây

    if (targetEmails.length === 0) {
      setIsDriveError(true); // Bật viền đỏ
      showMsg("Vui lòng chọn ít nhất một Drive!", "error"); // Thông báo bạn đã có
      return;
    }

    setIsDriveError(false); // Tắt lỗi nếu đã chọn


    if (selectedFiles.length === 0) return showMsg("Vui lòng chọn ít nhất 1 file", "warning");
    if (uploadTarget === "drive" && targetEmails.length === 0) return showMsg("Vui lòng chọn Drive đích", "warning");

    const filesToUpload = files.filter((f) => selectedFiles.includes(f.name));

    // 1. Chờ quá trình upload hoàn tất (onUpload cần là một async function từ App.jsx)
    try {
      setIsLoading(true); // Hiển thị loading trong khi chờ dọn dẹp
      // TRUYỀN THÊM folderName VÀO ĐÂY
      await onUpload(filesToUpload, targetEmails, folderName);

      // 2. Sau khi upload và server xóa file xong, ta gọi lại loadFiles để cập nhật UI
      // Thêm một chút delay nhỏ (khoảng 500ms) để đảm bảo ổ cứng đã kịp cập nhật trạng thái xóa
      setTimeout(async () => {
        await loadFiles();
        showMsg("Đã dọn dẹp danh sách file thành công", "success");
      }, 1000);

    } catch (error) {
      showMsg("Lỗi trong quá trình xử lý sau upload", "error");
    } finally {
      setIsLoading(false);
      // Logic setIsLoading(false) sẽ nằm trong loadFiles nên không cần ở đây
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: "bold" }}></Typography>

      {isLoading ? (
        <Box sx={{ width: '100%', p: 3, bgcolor: '#fbfcfd', borderRadius: '16px' }}>
          {/* Định nghĩa CSS Animation Keyframes - Đặt 1 lần ở đầu */}
          <style>
            {`
        @keyframes subtlePulse {
          0% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.01); }
          100% { opacity: 0.6; transform: scale(1); }
        }
        @keyframes meshGradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}
          </style>

          {/* Header Skeleton - Tĩnh, không cần animation để làm điểm tựa thị giác */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, mb: 3, pb: 1.5, borderBottom: "1px solid #edf2f7" }}>
            <Skeleton variant="rectangular" width={28} height={28} sx={{ borderRadius: '8px', bgcolor: '#e2e8f0' }} />
            <Skeleton variant="text" width="30%" height={35} sx={{ bgcolor: '#e2e8f0' }} />
            <Box sx={{ flexGrow: 1 }} />
            <Skeleton variant="text" width={90} height={30} sx={{ bgcolor: '#e2e8f0' }} />
            <Skeleton variant="text" width={70} height={30} sx={{ bgcolor: '#e2e8f0' }} />
          </Box>

          {/* List Items Skeleton - Nơi chứa hiệu ứng "thở" Mesh Gradient */}
          {[...Array(6)].map((_, index) => (
            <Box key={index} sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2.5,
              py: 2,
              borderBottom: "1px solid #f7fafc",
              // Hiệu ứng mạch đập nhẹ cho cả dòng
              animation: `subtlePulse 2s infinite ease-in-out`,
              animationDelay: `${index * 0.15}s`, // Tạo hiệu ứng gợn sóng lăn tăn
            }}>
              {/* Icon/Checkbox giả lập với nền Mesh Gradient */}
              <Box sx={{
                width: 28, height: 28, borderRadius: '8px',
                backgroundSize: '200% 200%',
                backgroundImage: 'linear-gradient(135deg, #e2e8f0 0%, #c7d2fe 50%, #e2e8f0 100%)',
                animation: 'meshGradient 4s infinite ease-in-out'
              }} />

              <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {/* Thanh tên file với nền Mesh Gradient Blue Neon mờ */}
                <Box sx={{
                  width: '60%', height: 20, borderRadius: '6px',
                  backgroundSize: '200% 200%',
                  backgroundImage: 'linear-gradient(90deg, #edf2f7 0%, #a5f3fc 50%, #edf2f7 100%)',
                  animation: 'meshGradient 3s infinite ease-in-out',
                  animationDelay: '0.5s'
                }} />
                <Skeleton variant="text" width="20%" height={15} sx={{ bgcolor: '#edf2f7' }} />
              </Box>

              <Skeleton variant="text" width={90} height={25} sx={{ bgcolor: '#edf2f7' }} />
              <Skeleton variant="text" width={70} height={25} sx={{ bgcolor: '#edf2f7' }} />
            </Box>
          ))}
        </Box>
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

          <Box sx={{ mb: 3 }}>
            <TextField
              fullWidth
              label="Tên thư mục lưu trữ trên Drive"
              variant="outlined"
              size="small"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="Mặc định: SQL_Backups"
              //helperText="File sẽ được tự động gom nhóm vào thư mục này"
              sx={{
                '& .MuiOutlinedInput-root': { borderRadius: '10px' }
              }}
            />
          </Box>

          <FormControl
            fullWidth
            size="small"
            error={isDriveError} // Kích hoạt trạng thái lỗi của MUI
          >
            <InputLabel
              sx={{
                // Chữ "Drive" cũng sẽ đổi màu khi có lỗi
                color: isDriveError ? "#d32f2f" : "inherit",
                "&.Mui-focused": { color: isDriveError ? "#d32f2f" : "primary.main" }
              }}
            >
              Drive
            </InputLabel>
            <Select
              multiple
              value={targetEmails}
              onChange={(e) => {
                handleEmailChange(e);
                if (e.target.value.length > 0) setIsDriveError(false); // Tự động tắt đỏ khi người dùng bắt đầu chọn
              }}
              input={<OutlinedInput label="Drive" />}
              renderValue={(selected) => (
                <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                  {selected.map((v) => (
                    <Chip
                      key={v}
                      label={v}
                      size="small"
                      sx={{
                        bgcolor: "rgba(25, 118, 210, 0.1)",
                        fontWeight: "bold",
                        borderRadius: "6px"
                      }}
                    />
                  ))}
                </Box>
              )}
              MenuProps={MenuProps}
              sx={{
                borderRadius: "10px",
                transition: "all 0.3s ease",
                // --- CSS CUSTOM VIỀN ĐỎ NEON KHI LỖI ---
                "& .MuiOutlinedInput-notchedOutline": {
                  borderWidth: isDriveError ? "2px" : "1px",
                  borderColor: isDriveError ? "#d32f2f !important" : "rgba(0, 0, 0, 0.23)",
                  boxShadow: isDriveError ? "0 0 10px rgba(211, 47, 47, 0.2)" : "none",
                },
                "&:hover .MuiOutlinedInput-notchedOutline": {
                  borderColor: isDriveError ? "#b71c1c !important" : "primary.main",
                },
                "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                  boxShadow: isDriveError ? "0 0 12px rgba(211, 47, 47, 0.3)" : "0 0 8px rgba(25, 118, 210, 0.2)",
                }
              }}
            >
              {driveAccounts.map((acc) => (
                <MenuItem
                  key={acc.email}
                  value={acc.email}
                  style={getStyles(acc.email, targetEmails, theme)}
                  sx={{ borderRadius: "8px", mx: 1, my: 0.5 }}
                >
                  {acc.label} ({acc.email})
                </MenuItem>
              ))}
            </Select>

            {/* Hiển thị dòng text nhỏ bên dưới nếu muốn chuyên nghiệp hơn nữa */}
            {isDriveError && (
              <Typography variant="caption" sx={{ color: "#d32f2f", mt: 0.5, ml: 1, fontWeight: "bold" }}>
                * Bắt buộc chọn nơi lưu trữ
              </Typography>
            )}
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
        <Button
          variant="contained"
          onClick={handleUploadClick}
          sx={{
            borderRadius: '12px',
            px: 4,
            py: 1.2,
            fontWeight: '800',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            color: '#fff',
            position: 'relative',
            overflow: 'hidden',
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            zIndex: 1,

            // --- GRADIENT XANH NEON CHẠY LIÊN TỤC ---
            backgroundSize: '200% 200%',
            backgroundImage: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 50%, #00f2fe 100%)',
            animation: 'neonFlow 3s ease infinite',

            '@keyframes neonFlow': {
              '0%': { backgroundPosition: '0% 50%' },
              '50%': { backgroundPosition: '100% 50%' },
              '100%': { backgroundPosition: '0% 50%' },
            },

            // --- HIỆU ỨNG PHÁT SÁNG (GLOW) ---
            boxShadow: '0 4px 15px rgba(0, 242, 254, 0.4)',

            // --- HIỆU ỨNG KHI HOVER (LUNG LINH) ---
            '&:hover': {
              transform: 'translateY(-3px) scale(1.02)',
              boxShadow: '0 8px 25px rgba(0, 242, 254, 0.6)',
              filter: 'brightness(1.1)',

              // Hiện vệt sáng quét qua khi hover
              '&::after': {
                left: '100%',
              }
            },

            // --- VỆT SÁNG KIM LOẠI (SHINE EFFECT) ---
            '&::after': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: '-100%',
              width: '100%',
              height: '100%',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
              transition: 'all 0.6s ease-in-out',
              zIndex: -1,
            },

            // Hiệu ứng khi click (nhấn nút)
            '&:active': {
              transform: 'scale(0.95)',
            },

            // Style cho phần số lượng file trong ngoặc (length)
            '& span': {
              marginLeft: '5px',
              fontSize: '0.85rem',
              opacity: 0.9
            }
          }}
        >
          Upload ({selectedFiles.length})
        </Button>
      </Box>
    </Box>
  );
};

export default UploadPanel;
