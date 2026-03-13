import React, { useState } from "react";
import {
  Box,
  TextField,
  Typography,
  InputAdornment,
  IconButton,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  Button,
  CircularProgress,
} from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import ServerIcon from "@mui/icons-material/Computer";
import DbIcon from "@mui/icons-material/Storage";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import LoginIcon from "@mui/icons-material/Login";

const FormRow = ({
  label,
  name,
  value,
  onChange,
  placeholder,
  type = "text",
  options = null,
}) => {
  const [showPass, setShowPass] = React.useState(false);

  if (options) {
    return (
      <FormControl fullWidth size="small" sx={{ mb: 2.5 }}>
        <InputLabel id={`${name}-label`}>{label}</InputLabel>
        <Select
          labelId={`${name}-label`}
          id={`${name}-select`}
          label={label}
          name={name}
          value={value}
          onChange={onChange}
        >
          {options.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    );
  }

  return (
    <TextField
      fullWidth
      size="small"
      variant="outlined"
      sx={{ mb: 2.5 }}
      label={label}
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      type={type === "password" && !showPass ? "password" : "text"}
      InputProps={
        type === "password"
          ? {
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowPass(!showPass)}
                    size="small"
                    edge="end"
                  >
                    {showPass ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }
          : undefined
      }
    />
  );
};

const dbOptions = [
  { label: "SQL Server", value: "sqlserver" },
  { label: "MySQL", value: "mysql" },
  { label: "MongoDB", value: "mongodb" },
];

export const ConnectionForm = ({ formData, setFormData, onConnectSuccess }) => {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleLoginDbClick = async () => {
  setIsLoading(true); // Bật loading
  try {
    await onConnectSuccess(); // Đợi logic ở cha chạy xong
  } finally {
    setIsLoading(false); // Tắt loading dù thành công hay thất bại
  }
};

  const handleNextStep = async () => {
    setErrorMsg("");
    setIsLoading(true);

    try {
      // Gọi xuống main.js để test SSH thực tế
      const result = await window.electronAPI.testSSHConnection(formData);
      if (result.success) {
        setStep(2); // Thành công mới cho qua bước 2
      } else {
        setErrorMsg(result.error); // Hiển thị lỗi cụ thể (sai pass, sai port, v.v)
      }
    } catch (err) {
      setErrorMsg("Lỗi hệ thống khi kiểm tra kết nối.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box sx={{ p: 4, maxWidth: 500, mx: "auto" }}>
      {/* Bước 1: Kết nối đến Server */}
      {step === 1 && (
        <Box>
          <Typography
            variant="subtitle1"
            sx={{
              mb: 3,
              fontWeight: "bold",
              color: "#1976d2",
              display: "flex",
              alignItems: "center",
            }}
          >
            <ServerIcon sx={{ mr: 1 }} /> 1. KẾT NỐI SERVER (SSH)
          </Typography>

          <FormRow
            label="Server Name / IP"
            name="server"
            value={formData.server}
            onChange={handleChange}
            placeholder="192.168.1.100"
          />
          <FormRow
            label="SSH Port"
            name="sshPort"
            value={formData.sshPort}
            onChange={handleChange}
            placeholder="22"
          />
          <FormRow
            label="Username"
            name="user"
            value={formData.user}
            onChange={handleChange}
          />
          <FormRow
            label="Password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            type="password"
          />

          {/* Dòng thông báo lỗi */}
          {errorMsg && (
            <Typography
              variant="caption"
              sx={{
                color: "#d32f2f",
                mb: 2,
                display: "block",
                fontWeight: "bold",
              }}
            >
              ⚠️ {errorMsg}
            </Typography>
          )}

          <Button
            fullWidth
            variant="contained"
            disabled={isLoading}
            onClick={handleNextStep}
            sx={{ py: 1.2, fontWeight: "bold" }}
          >
            {isLoading ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              "TIẾP THEO"
            )}
          </Button>
        </Box>
      )}

      {/* Bước 2: Cấu hình DB */}
      {step === 2 && (
        <Box>
          <Typography
            variant="subtitle1"
            sx={{
              mb: 3,
              display: "flex",
              alignItems: "center",
              fontWeight: "bold",
              color: "#2e7d32",
            }}
          >
            <DbIcon sx={{ mr: 1 }} /> 2. THÔNG TIN CƠ SỞ DỮ LIỆU
          </Typography>

          {/* Chọn loại DB và Port */}
          <FormRow
            label="Database Type"
            name="dbType"
            value={formData.dbType || "sqlserver"}
            onChange={handleChange}
            options={dbOptions}
          />

          <FormRow
            label="Database Port"
            name="port"
            value={formData.port}
            onChange={handleChange}
            placeholder="Mặc định: 1433"
          />

          {/* THÊM MỚI: Username để đăng nhập vào SQL Server (Ví dụ: sa) */}
          <FormRow
            label="Database Username"
            name="dbUser"
            value={formData.dbUser || ""}
            onChange={handleChange}
            placeholder="e.g, sa"
          />

          {/* THÊM MỚI: Password để đăng nhập vào SQL Server */}
          <FormRow
            label="Database Password"
            name="dbPassword"
            value={formData.dbPassword || ""}
            onChange={handleChange}
            placeholder="Nhập mật khẩu cơ sở dữ liệu"
            type="password"
          />

          <Box sx={{ display: "flex", gap: 2, mt: 2 }}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              onClick={() => {
                setErrorMsg(""); // Reset lỗi khi quay lại
                setStep(1);
              }}
            >
              Quay lại
            </Button>

            <Button
              fullWidth
              variant="contained"
              color="success"
              // 1. Thêm startIcon (ẩn đi khi đang load để tránh rối mắt)
              startIcon={!isLoading ? <LoginIcon /> : null}
              // 2. Disable nút khi đang loading
              disabled={isLoading}
              onClick={handleLoginDbClick}
              sx={{ py: 1.2, fontWeight: "bold" }} // Đồng bộ padding với nút bên dưới
            >
              {/* 3. Logic hiển thị CircularProgress hoặc Text */}
              {isLoading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                "Đăng nhập"
              )}
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
};
