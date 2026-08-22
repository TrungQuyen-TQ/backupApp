import React, { useState, useEffect } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Paper,
  Typography,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  Tooltip,
} from '@mui/material';
import LoginIcon from '@mui/icons-material/Login';
import StorageIcon from '@mui/icons-material/Storage';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import ServerIcon from '@mui/icons-material/Computer';
import KeyIcon from '@mui/icons-material/VpnKey';
import CloseIcon from '@mui/icons-material/Close';
import PersonIcon from '@mui/icons-material/Person';
import LanIcon from '@mui/icons-material/Lan';
import CheckIcon from '@mui/icons-material/Check';
import DescriptionIcon from '@mui/icons-material/Description';
import DnsIcon from '@mui/icons-material/Dns';

const dbOptions = [
  { label: 'SQL Server (MSSQL)', value: 'sqlserver', port: '1433' },
  { label: 'MySQL', value: 'mysql', port: '3306' },
  { label: 'MongoDB', value: 'mongodb', port: '27017' },
  { label: 'PostgreSQL', value: 'postgresql', port: '5432' },
];

export const ServerManager = ({ onScanAndConnect, showMsg }) => {
  const [servers, setServers] = useState([]);

  // States quản lý Modal Edit / Add
  const [openEditModal, setOpenEditModal] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [editingServer, setEditingServer] = useState({
    id: '',
    server: '',
    sshPort: '22',
    user: '',
    password: '',
    dbType: 'sqlserver',
    port: '1433',
    dbUser: 'sa',
    dbPassword: '',
    label: '',
  });

  // Toggle hiện/ẩn mật khẩu trong Popup
  const [showSshPass, setShowSshPass] = useState(false);
  const [showDbPass, setShowDbPass] = useState(false);

  // States quản lý Modal Xóa
  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [deletingServer, setDeletingServer] = useState(null);

  // Load danh sách Server từ info.json
  const loadServers = async () => {
    try {
      const result = await window.electronAPI.getLoginConfigs();
      if (result.success && result.serverConfigs) {
        // Gán id nếu chưa có để đảm bảo phân biệt các cấu hình
        const normalized = result.serverConfigs.map((item, idx) => ({
          ...item,
          id: item.id || item.label || `${item.server}_${item.dbType || 'sqlserver'}_${idx}`,
        }));
        setServers(normalized);
      }
    } catch (err) {
      console.error('Lỗi nạp danh sách server:', err);
    }
  };

  useEffect(() => {
    loadServers();
  }, []);

  const handleQuickConnect = async (server) => {
    if (showMsg) {
      showMsg(`🚀 Đang khởi tạo kết nối đến ${server.server}...`, 'info');
    }
    if (typeof onScanAndConnect === 'function') {
      onScanAndConnect(server);
    }
  };

  // Mở Popup Thêm Mới
  const handleOpenAdd = () => {
    setIsNew(true);
    setEditingServer({
      id: Date.now().toString(),
      server: '',
      sshPort: '22',
      user: 'root',
      password: '',
      dbType: 'sqlserver',
      port: '1433',
      dbUser: 'sa',
      dbPassword: '',
      label: '',
    });
    setShowSshPass(false);
    setShowDbPass(false);
    setOpenEditModal(true);
  };

  // Mở Popup Chỉnh Sửa
  const handleOpenEdit = (server) => {
    setIsNew(false);
    setEditingServer({
      id: server.id || Date.now().toString(),
      server: server.server || '',
      sshPort: server.sshPort || '22',
      user: server.user || '',
      password: server.password || '',
      dbType: server.dbType || 'sqlserver',
      port: server.port || '1433',
      dbUser: server.dbUser || '',
      dbPassword: server.dbPassword || '',
      label: server.label || '',
    });
    setShowSshPass(false);
    setShowDbPass(false);
    setOpenEditModal(true);
  };

  // Xử lý thay đổi Input trong Popup
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'dbType') {
      const matched = dbOptions.find((opt) => opt.value === value);
      const defaultPort = matched ? matched.port : '1433';
      setEditingServer((prev) => ({
        ...prev,
        dbType: value,
        port: defaultPort,
      }));
    } else {
      setEditingServer((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  // Lưu cấu hình từ Popup
  const handleSaveConfig = async () => {
    if (!editingServer.server.trim()) {
      if (showMsg) showMsg('⚠️ Vui lòng nhập Server Name / IP!', 'error');
      return;
    }

    const configToSave = {
      ...editingServer,
      label: editingServer.label.trim()
        ? editingServer.label.trim()
        : `${(editingServer.dbType || 'DB').toUpperCase()} (${editingServer.server})`,
    };

    try {
      const res = await window.electronAPI.saveLoginConfig(configToSave);
      if (res.success) {
        if (showMsg) {
          showMsg(
            isNew
              ? '✅ Đã thêm cấu hình Server mới!'
              : '✅ Đã cập nhật cấu hình Server thành công!',
            'success'
          );
        }
        setOpenEditModal(false);
        loadServers();
      } else {
        if (showMsg) showMsg(`❌ Lỗi khi lưu: ${res.error}`, 'error');
      }
    } catch (err) {
      if (showMsg) showMsg(`⚠️ Lỗi hệ thống: ${err.message}`, 'error');
    }
  };

  // Mở Popup Xác nhận Xóa
  const handleOpenDelete = (server) => {
    setDeletingServer(server);
    setOpenDeleteModal(true);
  };

  // Xóa cấu hình Server
  const handleConfirmDelete = async () => {
    if (!deletingServer) return;
    try {
      const res = await window.electronAPI.deleteLoginConfig(deletingServer);
      if (res.success) {
        if (showMsg) showMsg('🗑️ Đã xóa cấu hình Server!', 'success');
        setOpenDeleteModal(false);
        setDeletingServer(null);
        loadServers();
      } else {
        if (showMsg) showMsg(`❌ Lỗi xóa: ${res.error}`, 'error');
      }
    } catch (err) {
      if (showMsg) showMsg(`⚠️ Lỗi hệ thống: ${err.message}`, 'error');
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      {/* HEADER SECTION */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          width: '100%',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography
            variant="h6"
            sx={{ fontWeight: 800, color: '#1e293b', letterSpacing: '0.3px' }}
          >
            Danh sách Server đã lưu
          </Typography>
          <Chip
            label={`${servers.length} Server`}
            size="small"
            sx={{
              fontWeight: 800,
              bgcolor: '#e0f2fe',
              color: '#0284c7',
              borderRadius: '8px',
            }}
          />
        </Box>

        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          onClick={handleOpenAdd}
          sx={{
            borderRadius: '12px',
            px: 2.5,
            py: 1,
            fontWeight: 800,
            textTransform: 'none',
            fontSize: '0.85rem',
            color: '#fff',
            backgroundSize: '200% 200%',
            backgroundImage:
              'linear-gradient(135deg, #10b981 0%, #059669 50%, #10b981 100%)',
            boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
            transition: 'all 0.3s ease',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: '0 6px 20px rgba(16, 185, 129, 0.5)',
              filter: 'brightness(1.1)',
            },
          }}
        >
          Thêm Server mới
        </Button>
      </Box>

      {/* DANH SÁCH CARDS SERVER */}
      <Paper
        elevation={0}
        sx={{
          bgcolor: 'transparent',
          borderRadius: '16px',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ p: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {servers.map((server, index) => (
            <Paper
              key={server.id || index}
              elevation={0}
              sx={{
                bgcolor: '#fff',
                borderRadius: '16px',
                p: 2.5,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                border: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 2,
                boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                '&:hover': {
                  transform: 'translateY(-3px)',
                  boxShadow: '0 12px 28px rgba(0,0,0,0.07)',
                  borderColor: '#3b82f6',
                  '& .server-icon-box': {
                    bgcolor: '#3b82f6',
                    color: '#fff',
                    transform: 'rotate(8deg) scale(1.05)',
                  },
                },
              }}
            >
              {/* BÊN TRÁI: ICON + THÔNG TIN SERVER */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, minWidth: 0 }}>
                <Box
                  className="server-icon-box"
                  sx={{
                    p: 1.8,
                    borderRadius: '14px',
                    bgcolor: '#f0f7ff',
                    color: '#2563eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'all 0.3s ease',
                  }}
                >
                  <StorageIcon fontSize="medium" />
                </Box>

                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5, flexWrap: 'wrap' }}>
                    <Typography
                      variant="subtitle1"
                      sx={{ fontWeight: 800, color: '#0f172a', fontSize: '1.05rem', lineHeight: 1.2 }}
                    >
                      {server.server}
                    </Typography>
                    <Chip
                      label={(server.dbType || 'MSSQL').toUpperCase()}
                      size="small"
                      sx={{
                        height: 22,
                        fontSize: '0.65rem',
                        fontWeight: 900,
                        bgcolor:
                          server.dbType === 'mongodb'
                            ? '#dcfce7'
                            : server.dbType === 'mysql'
                            ? '#fef3c7'
                            : server.dbType === 'postgresql'
                            ? '#ede9fe'
                            : '#e0f2fe',
                        color:
                          server.dbType === 'mongodb'
                            ? '#15803d'
                            : server.dbType === 'mysql'
                            ? '#b45309'
                            : server.dbType === 'postgresql'
                            ? '#6d28d9'
                            : '#0369a1',
                        borderRadius: '6px',
                      }}
                    />
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                      DB User: <b style={{ color: '#1e293b' }}>{server.dbUser || 'N/A'}</b>
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#cbd5e1' }}>|</Typography>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                      DB Port: <b style={{ color: '#1e293b' }}>{server.port || '1433'}</b>
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#cbd5e1' }}>|</Typography>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                      SSH User: <b style={{ color: '#1e293b' }}>{server.user || 'root'}</b>
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#cbd5e1' }}>|</Typography>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                      SSH Port: <b style={{ color: '#1e293b' }}>{server.sshPort || '22'}</b>
                    </Typography>
                  </Box>

                  {server.label && (
                    <Typography
                      variant="caption"
                      sx={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.72rem', display: 'block', mt: 0.3 }}
                    >
                      🏷️ {server.label}
                    </Typography>
                  )}
                </Box>
              </Box>

              {/* BÊN PHẢI: NHÓM NÚT THAO TÁC */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                {/* NÚT SỬA */}
                <Tooltip title="Chỉnh sửa thông tin" arrow placement="top">
                  <IconButton
                    size="small"
                    onClick={() => handleOpenEdit(server)}
                    sx={{
                      color: '#0284c7',
                      bgcolor: '#f0f9ff',
                      borderRadius: '10px',
                      p: 1,
                      transition: 'all 0.2s',
                      '&:hover': {
                        bgcolor: '#0284c7',
                        color: '#fff',
                        transform: 'scale(1.1)',
                      },
                    }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>

                {/* NÚT XÓA */}
                <Tooltip title="Xóa cấu hình" arrow placement="top">
                  <IconButton
                    size="small"
                    onClick={() => handleOpenDelete(server)}
                    sx={{
                      color: '#ef4444',
                      bgcolor: '#fef2f2',
                      borderRadius: '10px',
                      p: 1,
                      transition: 'all 0.2s',
                      '&:hover': {
                        bgcolor: '#ef4444',
                        color: '#fff',
                        transform: 'scale(1.1)',
                      },
                    }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>

                {/* NÚT KẾT NỐI */}
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<LoginIcon />}
                  onClick={() => handleQuickConnect(server)}
                  sx={{
                    borderRadius: '12px',
                    px: 2.5,
                    py: 0.9,
                    fontWeight: '800',
                    textTransform: 'none',
                    letterSpacing: '0.3px',
                    color: '#fff',
                    position: 'relative',
                    overflow: 'hidden',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    ml: 0.5,
                    backgroundSize: '200% 200%',
                    backgroundImage:
                      'linear-gradient(135deg, #00f2fe 0%, #4facfe 50%, #00f2fe 100%)',
                    animation: 'neonFlow 3s ease infinite',
                    '@keyframes neonFlow': {
                      '0%': { backgroundPosition: '0% 50%' },
                      '50%': { backgroundPosition: '100% 50%' },
                      '100%': { backgroundPosition: '0% 50%' },
                    },
                    boxShadow: '0 4px 14px rgba(0, 242, 254, 0.35)',
                    '&:hover': {
                      transform: 'translateY(-2px) scale(1.03)',
                      boxShadow: '0 8px 22px rgba(0, 242, 254, 0.55)',
                      filter: 'brightness(1.08)',
                    },
                  }}
                >
                  Kết nối
                </Button>
              </Box>
            </Paper>
          ))}

          {/* Trạng thái trống */}
          {servers.length === 0 && (
            <Paper
              variant="outlined"
              sx={{
                p: 5,
                textAlign: 'center',
                borderRadius: '16px',
                borderStyle: 'dashed',
                bgcolor: '#ffffff80',
                borderColor: '#cbd5e1',
              }}
            >
              <StorageIcon sx={{ fontSize: 48, color: '#94a3b8', mb: 1 }} />
              <Typography variant="subtitle1" sx={{ color: '#64748b', fontWeight: 700 }}>
                Chưa có cấu hình server nào được lưu.
              </Typography>
              <Typography variant="body2" sx={{ color: '#94a3b8', mt: 0.5, mb: 2 }}>
                Nhấn nút "Thêm Server mới" để tạo cấu hình lưu sẵn.
              </Typography>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={handleOpenAdd}
                sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 700 }}
              >
                Thêm Server ngay
              </Button>
            </Paper>
          )}
        </Box>
      </Paper>

      {/* POPUP THÊM / SỬA CẤU HÌNH SERVER */}
      <Dialog
        open={openEditModal}
        onClose={() => setOpenEditModal(false)}
        maxWidth="sm"
        fullWidth
        disableEnforceFocus
        disableRestoreFocus
        PaperProps={{
          sx: {
            borderRadius: '24px',
            boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.25)',
            overflow: 'hidden',
            bgcolor: '#ffffff',
          },
        }}
      >
        {/* HEADER MODAL */}
        <DialogTitle
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            px: 3.5,
            py: 2.5,
            bgcolor: '#f8fafc',
            borderBottom: '1px solid #f1f5f9',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: '14px',
                background: isNew
                  ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                  : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: isNew
                  ? '0 4px 14px rgba(16, 185, 129, 0.35)'
                  : '0 4px 14px rgba(37, 99, 235, 0.35)',
              }}
            >
              {isNew ? <AddIcon /> : <EditIcon />}
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
                {isNew ? 'Thêm cấu hình Server mới' : 'Chỉnh sửa cấu hình Server'}
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 500, display: 'block', mt: 0.3 }}>
                Nhập thông tin kết nối đến máy chủ và cơ sở dữ liệu
              </Typography>
            </Box>
          </Box>
          <IconButton
            size="small"
            onClick={() => setOpenEditModal(false)}
            sx={{
              color: '#94a3b8',
              bgcolor: '#ffffff',
              border: '1px solid #e2e8f0',
              p: 0.8,
              transition: 'all 0.2s',
              '&:hover': {
                bgcolor: '#f1f5f9',
                color: '#0f172a',
              },
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        {/* NỘI DUNG FORM */}
        <DialogContent sx={{ px: 3.5, py: 3,  mt: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {/* NHÓM 1: SERVER & SSH */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                color: '#2563eb',
                fontWeight: 800,
                fontSize: '0.78rem',
                letterSpacing: '0.5px',
                bgcolor: '#eff6ff',
                py: 0.7,
                px: 1.5,
                borderRadius: '8px',
                borderLeft: '4px solid #2563eb',
                width: 'fit-content',
              }}
            >
              <ServerIcon fontSize="small" />
              <span>THÔNG TIN MÁY CHỦ & SSH</span>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 2 }}>
              <TextField
                label="Server Name / IP"
                name="server"
                value={editingServer.server}
                onChange={handleInputChange}
                size="small"
                fullWidth
                required
                placeholder="192.168.1.100"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px',
                    bgcolor: '#fafafa',
                    transition: 'all 0.2s ease',
                    '&:hover fieldset': { borderColor: '#3b82f6' },
                    '&.Mui-focused': {
                      bgcolor: '#fff',
                      '& fieldset': { borderColor: '#2563eb', borderWidth: '2px' },
                    },
                  },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <DnsIcon fontSize="small" sx={{ color: '#64748b' }} />
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                label="SSH Port"
                name="sshPort"
                value={editingServer.sshPort}
                onChange={handleInputChange}
                size="small"
                fullWidth
                placeholder="22"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px',
                    bgcolor: '#fafafa',
                    transition: 'all 0.2s ease',
                    '&:hover fieldset': { borderColor: '#3b82f6' },
                    '&.Mui-focused': {
                      bgcolor: '#fff',
                      '& fieldset': { borderColor: '#2563eb', borderWidth: '2px' },
                    },
                  },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LanIcon fontSize="small" sx={{ color: '#64748b' }} />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField
                label="SSH Username"
                name="user"
                value={editingServer.user}
                onChange={handleInputChange}
                size="small"
                fullWidth
                placeholder="root"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px',
                    bgcolor: '#fafafa',
                    transition: 'all 0.2s ease',
                    '&:hover fieldset': { borderColor: '#3b82f6' },
                    '&.Mui-focused': {
                      bgcolor: '#fff',
                      '& fieldset': { borderColor: '#2563eb', borderWidth: '2px' },
                    },
                  },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonIcon fontSize="small" sx={{ color: '#64748b' }} />
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                label="SSH Password"
                name="password"
                type={showSshPass ? 'text' : 'password'}
                value={editingServer.password}
                onChange={handleInputChange}
                size="small"
                fullWidth
                placeholder="••••••••••••"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px',
                    bgcolor: '#fafafa',
                    transition: 'all 0.2s ease',
                    '&:hover fieldset': { borderColor: '#3b82f6' },
                    '&.Mui-focused': {
                      bgcolor: '#fff',
                      '& fieldset': { borderColor: '#2563eb', borderWidth: '2px' },
                    },
                  },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <KeyIcon fontSize="small" sx={{ color: '#64748b' }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowSshPass(!showSshPass)}
                        edge="end"
                        size="small"
                        sx={{ color: '#94a3b8' }}
                      >
                        {showSshPass ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Box>

            {/* NHÓM 2: CƠ SỞ DỮ LIỆU */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                color: '#16a34a',
                fontWeight: 800,
                fontSize: '0.78rem',
                letterSpacing: '0.5px',
                bgcolor: '#f0fdf4',
                py: 0.7,
                px: 1.5,
                borderRadius: '8px',
                borderLeft: '4px solid #16a34a',
                width: 'fit-content',
                mt: 1,
              }}
            >
              <StorageIcon fontSize="small" />
              <span>THÔNG TIN CƠ SỞ DỮ LIỆU</span>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 2 }}>
              <FormControl fullWidth size="small">
                <InputLabel id="db-type-select-label">Loại Database</InputLabel>
                <Select
                  labelId="db-type-select-label"
                  label="Loại Database"
                  name="dbType"
                  value={editingServer.dbType}
                  onChange={handleInputChange}
                  sx={{
                    borderRadius: '12px',
                    bgcolor: '#fafafa',
                    transition: 'all 0.2s ease',
                    '&:hover': { borderColor: '#3b82f6' },
                    '&.Mui-focused': { bgcolor: '#fff' },
                  }}
                  startAdornment={
                    <InputAdornment position="start" sx={{ ml: 0.5, mr: 1.5 }}>
                      <StorageIcon fontSize="small" sx={{ color: '#64748b' }} />
                    </InputAdornment>
                  }
                >
                  {dbOptions.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value} sx={{ py: 1, px: 2 }}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="DB Port"
                name="port"
                value={editingServer.port}
                onChange={handleInputChange}
                size="small"
                fullWidth
                placeholder="1433"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px',
                    bgcolor: '#fafafa',
                    transition: 'all 0.2s ease',
                    '&:hover fieldset': { borderColor: '#3b82f6' },
                    '&.Mui-focused': {
                      bgcolor: '#fff',
                      '& fieldset': { borderColor: '#2563eb', borderWidth: '2px' },
                    },
                  },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LanIcon fontSize="small" sx={{ color: '#64748b' }} />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField
                label="Database Username"
                name="dbUser"
                value={editingServer.dbUser}
                onChange={handleInputChange}
                size="small"
                fullWidth
                placeholder="sa / root"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px',
                    bgcolor: '#fafafa',
                    transition: 'all 0.2s ease',
                    '&:hover fieldset': { borderColor: '#3b82f6' },
                    '&.Mui-focused': {
                      bgcolor: '#fff',
                      '& fieldset': { borderColor: '#2563eb', borderWidth: '2px' },
                    },
                  },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonIcon fontSize="small" sx={{ color: '#64748b' }} />
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                label="Database Password"
                name="dbPassword"
                type={showDbPass ? 'text' : 'password'}
                value={editingServer.dbPassword}
                onChange={handleInputChange}
                size="small"
                fullWidth
                placeholder="••••••••••••"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px',
                    bgcolor: '#fafafa',
                    transition: 'all 0.2s ease',
                    '&:hover fieldset': { borderColor: '#3b82f6' },
                    '&.Mui-focused': {
                      bgcolor: '#fff',
                      '& fieldset': { borderColor: '#2563eb', borderWidth: '2px' },
                    },
                  },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <KeyIcon fontSize="small" sx={{ color: '#64748b' }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowDbPass(!showDbPass)}
                        edge="end"
                        size="small"
                        sx={{ color: '#94a3b8' }}
                      >
                        {showDbPass ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Box>

            {/* NHÓM 3: GHI CHÚ */}
            <TextField
              label="Tên gợi nhớ / Ghi chú (Tùy chọn)"
              name="label"
              value={editingServer.label}
              onChange={handleInputChange}
              size="small"
              fullWidth
              placeholder="VD: Server production - Backup hàng ngày"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '12px',
                  bgcolor: '#fafafa',
                  transition: 'all 0.2s ease',
                  '&:hover fieldset': { borderColor: '#3b82f6' },
                  '&.Mui-focused': {
                    bgcolor: '#fff',
                    '& fieldset': { borderColor: '#2563eb', borderWidth: '2px' },
                  },
                },
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <DescriptionIcon fontSize="small" sx={{ color: '#64748b' }} />
                  </InputAdornment>
                ),
              }}
            />
          </Box>
        </DialogContent>

        {/* FOOTER ACTIONS */}
        <DialogActions
          sx={{
            px: 3.5,
            py: 2,
            bgcolor: '#f8fafc',
            borderTop: '1px solid #f1f5f9',
            gap: 1.5,
          }}
        >
          <Button
            onClick={() => setOpenEditModal(false)}
            variant="outlined"
            startIcon={<CloseIcon />}
            sx={{
              borderRadius: '12px',
              textTransform: 'none',
              fontWeight: 700,
              px: 3,
              py: 0.9,
              borderColor: '#cbd5e1',
              color: '#64748b',
              bgcolor: '#ffffff',
              '&:hover': {
                bgcolor: '#f1f5f9',
                borderColor: '#94a3b8',
                color: '#334155',
              },
            }}
          >
            Hủy
          </Button>
          <Button
            onClick={handleSaveConfig}
            variant="contained"
            startIcon={<CheckIcon />}
            sx={{
              borderRadius: '12px',
              textTransform: 'none',
              fontWeight: 800,
              px: 3.5,
              py: 0.9,
              color: '#ffffff',
              backgroundSize: '200% 200%',
              backgroundImage:
                'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              boxShadow: '0 4px 16px rgba(37, 99, 235, 0.4)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                transform: 'translateY(-1px) scale(1.02)',
                boxShadow: '0 8px 24px rgba(37, 99, 235, 0.6)',
                filter: 'brightness(1.08)',
              },
            }}
          >
            {isNew ? 'Thêm mới' : 'Lưu thay đổi'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* POPUP XÁC NHẬN XÓA */}
      <Dialog
        open={openDeleteModal}
        onClose={() => setOpenDeleteModal(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '20px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            overflow: 'hidden',
          },
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            px: 3,
            py: 2,
            bgcolor: '#fef2f2',
            borderBottom: '1px solid #fee2e2',
          }}
        >
          <Box
            sx={{
              p: 1,
              borderRadius: '10px',
              bgcolor: '#fee2e2',
              color: '#ef4444',
              display: 'flex',
            }}
          >
            <DeleteIcon />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 800, color: '#991b1b', fontSize: '1.1rem' }}>
            Xác nhận xóa cấu hình
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ px: 3, py: 2.5 }}>
          <Typography variant="body2" sx={{ color: '#475569', fontWeight: 500, lineHeight: 1.6 }}>
            Bạn có chắc chắn muốn xóa cấu hình server{' '}
            <b style={{ color: '#0f172a' }}>{deletingServer?.server}</b> (
            {(deletingServer?.dbType || 'MSSQL').toUpperCase()}) khỏi danh sách không?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button
            onClick={() => setOpenDeleteModal(false)}
            variant="outlined"
            size="small"
            startIcon={<CloseIcon />}
            sx={{
              borderRadius: '10px',
              textTransform: 'none',
              fontWeight: 700,
              px: 2.5,
              borderColor: '#cbd5e1',
              color: '#64748b',
            }}
          >
            Hủy
          </Button>
          <Button
            onClick={handleConfirmDelete}
            variant="contained"
            color="error"
            size="small"
            startIcon={<DeleteIcon />}
            sx={{
              borderRadius: '10px',
              textTransform: 'none',
              fontWeight: 800,
              px: 2.5,
              boxShadow: '0 4px 14px rgba(239, 68, 68, 0.35)',
              '&:hover': {
                bgcolor: '#dc2626',
                boxShadow: '0 6px 18px rgba(239, 68, 68, 0.5)',
              },
            }}
          >
            Xóa cấu hình
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};