import React, { useState, useEffect } from "react";
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
  Autocomplete,
} from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import ServerIcon from "@mui/icons-material/Computer";
import DbIcon from "@mui/icons-material/Storage";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import LoginIcon from "@mui/icons-material/Login";
import dataConfig from "../../configs/info.json";

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
  { label: "SQL Server", value: "sqlserver", port: "1433" },
  { label: "MySQL", value: "mysql", port: "3306" },
  { label: "MongoDB", value: "mongodb", port: "27017" },
  { label: "PostgreSQL", value: "postgresql", port: "5432" },
];
export const ConnectionForm = ({ formData, setFormData, onConnectSuccess, showMsg, onLoginSuccess, initialData }) => {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [serverOptions, setServerOptions] = useState([]);

console.log(">>> [Form] Props nhận được:", { initialData })

  // LẤY DỮ LIỆU ĐỘNG KHI MỞ TAB
  useEffect(() => {
    const fetchConfigs = async () => {
      const res = await window.electronAPI.getLoginConfigs();
      if (res && res.serverConfigs) {
        setServerOptions(res.serverConfigs);
      }
    };
    fetchConfigs();
  }, []);


  // ConnectionForm.jsx
  // Thay thế đoạn useEffect xử lý initialData cũ bằng đoạn này:
  useEffect(() => {
    if (initialData) {
      console.log(">>> [Form] Phát hiện có dữ liệu server mới:", initialData);
      setFormData(initialData);
      const timer = setTimeout(() => {
        console.log(">>> [Form] Đang tự động kích hoạt handleNextStep...");
        handleNextStep();
      }, 500);
      return () => clearTimeout(timer); // Thêm cái này để xóa bộ nhớ đệm, giúp App mượt hơn.
    }
  }, [initialData]);



  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "dbType") {
      const selectedOption = dbOptions.find((opt) => opt.value === value);
      if (selectedOption) {
        formData.port = selectedOption.port;
      }
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const generateLabel = (data) => {
    const dbName = data.dbType || "DB";
    return `${dbName.toUpperCase()} (${data.server})`;
  };

  const handleSaveConfig = async (currentData) => {
    const configToSave = {
      ...currentData,
      label: generateLabel(currentData) // Render label theo quy tắc bạn muốn
    };

    try {
      // Gọi API của Electron để ghi file
      const result = await window.electronAPI.saveLoginConfig(configToSave);
      if (result.success) {
        console.log("Đã lưu cấu hình thành công!");
        // Bạn có thể reload lại dataConfig ở đây nếu cần
      }
    } catch (err) {
      console.error("Lỗi khi lưu file:", err);
    }
  };

  const handleLoginDbClick = async () => {
    setIsLoading(true); // Bật loading
    try {
      console.log("Form Data trước khi test connection:", formData);
      await onConnectSuccess(); // Đợi logic ở cha chạy xong
      await handleSaveConfig(formData);
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
            <ServerIcon sx={{ mr: 1 }} /> 1. KẾT NỐI SERVER
          </Typography>

          <Autocomplete
            freeSolo
            // Sử dụng dữ liệu từ file info.json đã import
            options={serverOptions}
            // Xác định cách hiển thị nhãn trong danh sách thả xuống
            getOptionLabel={(option) => {
              if (typeof option === "string") return option;
              return option.label || option.server || "";
            }}
            // Cấu hình giao diện đồng bộ với các FormRow khác
            fullWidth
            size="small"
            sx={{ mb: 2.5 }}
            // Liên kết giá trị với formData.server
            value={formData.server || ""}
            // XỬ LÝ KHI CHỌN ITEM HOẶC NHẤN ENTER
            onChange={(event, newValue) => {
              if (newValue && typeof newValue === "object") {
                // TRƯỜNG HỢP 1: Chọn một Object cấu hình từ danh sách
                // Cập nhật tất cả các trường có trong Object đó vào formData
                setFormData((prev) => ({
                  ...prev,
                  ...newValue, // Ghi đè: server, sshPort, user, password, dbUser, dbPassword...
                }));
              } else {
                // TRƯỜNG HỢP 2: Người dùng gõ xong và nhấn Enter (newValue là string)
                setFormData((prev) => ({
                  ...prev,
                  server: newValue || "",
                }));
              }
            }}
            // XỬ LÝ KHI ĐANG GÕ (Input thay đổi liên tục)
            onInputChange={(event, newInputValue) => {
              setFormData((prev) => ({
                ...prev,
                server: newInputValue,
              }));
            }}
            // Render ô nhập liệu chính (TextField)
            renderInput={(params) => (
              <TextField
                {...params}
                label="Server Name / IP"
                placeholder="Chọn cấu hình hoặc nhập IP..."
                variant="outlined"
                fullWidth
                InputProps={{
                  ...params.InputProps,
                  startAdornment: (
                    <InputAdornment position="start" sx={{ pl: 1 }}>
                      <ServerIcon fontSize="small" color="action" />
                      {params.InputProps.startAdornment}
                    </InputAdornment>
                  ),
                }}
              />
            )}
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
            sx={{
              py: 1.5,
              borderRadius: "14px",
              fontWeight: "800",
              fontSize: "1rem",
              textTransform: "uppercase",
              letterSpacing: "1.5px",
              position: "relative",
              overflow: "hidden",
              transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
              color: "#fff !important", // Ép màu chữ trắng kể cả khi disabled

              // --- GRADIENT LUÔN CHẠY BẤT CHẤP LOADING ---
              backgroundSize: "200% 200%",
              backgroundImage: isLoading
                ? "linear-gradient(135deg, #00d2ff 0%, #3a7bd5 50%, #00d2ff 100%) !important" // Giữ màu xanh neon khi load
                : "linear-gradient(135deg, #00d2ff 0%, #3a7bd5 50%, #00d2ff 100%)",

              // Animation không bao giờ dừng
              animation: "blueGradientMove 3s ease infinite",

              "@keyframes blueGradientMove": {
                "0%": { backgroundPosition: "0% 50%" },
                "50%": { backgroundPosition: "100% 50%" },
                "100%": { backgroundPosition: "0% 50%" },
              },

              // --- HIỆU ỨNG PHÁT SÁNG KHI ĐANG LOAD ---
              boxShadow: isLoading
                ? "0 0 20px rgba(0, 210, 255, 0.6), 0 0 40px rgba(0, 210, 255, 0.2)"
                : "0 4px 15px rgba(0, 210, 255, 0.3)",

              // Đảm bảo hover vẫn có filter khi không bị khóa
              "&:hover": {
                transform: !isLoading ? "translateY(-3px)" : "none",
                filter: "brightness(1.1)",
              },

              // --- CẤU HÌNH QUAN TRỌNG ĐỂ VƯỢT QUA DISABLED THÔ KỆCH ---
              "&.Mui-disabled": {
                opacity: 1, // Không cho phép làm mờ nút
                cursor: "not-allowed",
                // Lớp phủ tối nhẹ để làm nổi bật vòng xoay nhưng vẫn thấy gradient chạy bên dưới
                "&::before": {
                  content: '""',
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: "rgba(0, 0, 0, 0.15)",
                  zIndex: 0,
                }
              }
            }}
          >
            {isLoading ? (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <CircularProgress
                  size={20}
                  color="inherit"
                  thickness={6}
                  sx={{
                    filter: "drop-shadow(0 0 5px rgba(255,255,255,0.5))"
                  }}
                />
                <Typography
                  variant="button"
                  sx={{
                    fontWeight: 800,
                    letterSpacing: "1px",
                    animation: "pulseText 1.5s infinite"
                  }}
                >
                  Đang xử lý...
                </Typography>
              </Box>
            ) : (
              "Đăng Nhập"
            )}

            {/* Hiệu ứng xung nhịp cho chữ khi loading */}
            <style>
              {`
                @keyframes pulseText {
                  0% { opacity: 0.6; }
                  50% { opacity: 1; }
                  100% { opacity: 0.6; }
                }
              `}
            </style>
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
                setStep(1); //
              }}
              sx={{
                py: 1.2,
                borderRadius: "12px",
                fontWeight: "800",
                textTransform: "none",
                fontSize: "0.9rem",
                color: "#64748b", // Màu xám xanh hiện đại
                position: "relative",
                border: "2px solid #e2e8f0", // Viền mặc định mảnh
                transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                bgcolor: "transparent",
                overflow: "hidden",

                // --- HIỆU ỨNG HOVER BIẾN HÌNH ---
                "&:hover": {
                  color: "#1976d2",
                  border: "2px solid transparent", // Làm trong suốt viền thật để hiện viền gradient
                  transform: "translateX(-5px)", // Nhích nhẹ sang trái tạo cảm giác "quay lại"
                  bgcolor: "rgba(25, 118, 210, 0.04)",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.05)",

                  // Hiệu ứng icon rung nhẹ
                  "& .MuiButton-startIcon": {
                    animation: "moveLeft 0.5s infinite alternate",
                  },
                },

                // --- ANIMATION CHO ICON QUAY LẠI ---
                "@keyframes moveLeft": {
                  "0%": { transform: "translateX(0)" },
                  "100%": { transform: "translateX(-3px)" }
                },

                // --- LỚP PHỦ GRADIENT KHI HOVER (VIỀN CHẠY) ---
                "&::before": {
                  content: '""',
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  borderRadius: "12px",
                  padding: "2px", // Độ dày của viền gradient
                  background: "linear-gradient(135deg, #64748b 0%, #1976d2 50%, #64748b 100%)",
                  mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                  maskComposite: "exclude",
                  WebkitMaskComposite: "destination-out",
                  opacity: 0,
                  transition: "opacity 0.4s",
                },

                "&:hover::before": {
                  opacity: 1,
                  animation: "borderRotate 2s linear infinite",
                },

                "@keyframes borderRotate": {
                  "0%": { filter: "hue-rotate(0deg)" },
                  "100%": { filter: "hue-rotate(360deg)" }
                },

                // Hiệu ứng click
                "&:active": {
                  transform: "scale(0.96) translateX(-5px)",
                }
              }}
            >
              Quay lại
            </Button>

            <Button
              fullWidth
              variant="contained"
              startIcon={!isLoading ? <LoginIcon /> : null}
              disabled={isLoading}
              onClick={handleLoginDbClick}
              sx={{
                py: 1.2,
                borderRadius: "12px",
                fontWeight: "800",
                fontSize: "0.95rem",
                textTransform: "uppercase",
                letterSpacing: "1px",
                position: "relative",
                overflow: "hidden",
                transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                color: "#fff",
                border: "none",
                boxShadow: "0 4px 15px rgba(16, 185, 129, 0.3)",

                // --- GRADIENT XANH LÁ NEON CHUYỂN ĐỘNG ---
                backgroundSize: "200% 200%",
                backgroundImage: isLoading
                  ? "linear-gradient(45deg, #10b981, #059669, #10b981)" // Đậm hơn khi loading
                  : "linear-gradient(135deg, #10b981 0%, #34d399 50%, #10b981 100%)",

                // Animation chỉ chạy khi không loading để người dùng tập trung vào vòng xoay
                animation: !isLoading ? "greenGradientMove 3s ease infinite" : "none",

                "@keyframes greenGradientMove": {
                  "0%": { backgroundPosition: "0% 50%" },
                  "50%": { backgroundPosition: "100% 50%" },
                  "100%": { backgroundPosition: "0% 50%" },
                },

                // --- HIỆU ỨNG KHI HOVER ---
                "&:hover": {
                  transform: "translateY(-3px) scale(1.01)",
                  filter: "brightness(1.1)",
                  boxShadow: "0 10px 25px rgba(16, 185, 129, 0.5)",
                  "&::after": {
                    left: "100%",
                  },
                },

                // --- HIỆU ỨNG ÁNH KIM (SHINE EFFECT) ---
                "&::after": {
                  content: '""',
                  position: "absolute",
                  top: 0,
                  left: "-100%",
                  width: "100%",
                  height: "100%",
                  background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)",
                  transition: "all 0.6s",
                },

                // Khi bị Disable (Loading)
                "&.Mui-disabled": {
                  background: "#d1d5db",
                  color: "#9ca3af",
                  boxShadow: "none",
                },

                // Hiệu ứng click
                "&:active": {
                  transform: "scale(0.98)",
                }
              }}
            >
              {isLoading ? (
                <CircularProgress size={24} color="inherit" thickness={5} />
              ) : (
                "Lựa chọn"
              )}
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
};
