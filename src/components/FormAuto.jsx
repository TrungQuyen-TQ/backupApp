import React, { useState, useMemo } from "react";
import {
  Box,
  TextField,
  Typography,
  FormControl,
  Button,
  Autocomplete,
  Checkbox,
  Alert,
  Divider,
  Stack,
} from "@mui/material";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import StorageIcon from "@mui/icons-material/Storage";
import ScheduleIcon from "@mui/icons-material/Schedule";
import AddIcon from "@mui/icons-material/Add";
import IconButton from "@mui/material/IconButton";

const icon = <CheckBoxOutlineBlankIcon fontSize="small" />;
const checkedIcon = <CheckBoxIcon fontSize="small" />;

export const FormAuto = ({
  connectionLogs,
  setActiveTab,
  onFetchDatabases,
  dbList,
  isFetching,
}) => {
  const handleServerChange = (e) => {
    const serverId = e.target.value;
    const conn = successfulConnections.find(
      (c) => String(c.id) === String(serverId),
    );

    setSelectedServer(conn);

    if (conn) {
      // Gọi hàm của App.jsx truyền xuống
      // conn.raw chính là đối tượng "log" chứa config
      onFetchDatabases(conn.raw, false); // Không show modal chọn DB nữa vì đã có sẵn list DB trả về
      setSelectedDBs([]); // Reset danh sách chọn cũ
    }
  };
  // 1. Lọc danh sách các kết nối thành công (Unique bằng Server + Type)
  const successfulConnections = useMemo(() => {
    const successLogs = connectionLogs.filter((log) => log.success);
    // Lọc trùng để hiển thị danh sách gọn gàng
    const unique = [];
    const map = new Map();
    for (const item of successLogs) {
      const key = `${item.server}-${item.dbType}`;
      if (!map.has(key)) {
        map.set(key, true);
        unique.push({
          id: item.id,
          displayName: `${item.server} (${item.dbType})`,
          raw: item,
        });
      }
    }
    return unique;
  }, [connectionLogs]);

  // 2. States quản lý form
  const [selectedServer, setSelectedServer] = useState(null);
  const [selectedDBs, setSelectedDBs] = useState([]);
  const [schedule, setSchedule] = useState({
    type: "day", // Mặc định là theo ngày
    interval: 1, // Mỗi 1 đơn vị
    time: "02:00", // Giờ bắt đầu
    retention: 7, // Số bản giữ lại
  });

  const handleSaveConfig = () => {
    const finalConfig = {
      server: selectedServer?.raw,
      databases: selectedDBs,
      schedule: schedule,
    };
    console.log("Đã lưu cấu hình Auto Backup:", finalConfig);
    // Gọi IPC xuống Electron ở đây
  };

  return (
    <Box sx={{ p: 3, maxWidth: 600, mx: "auto" }}>
      <Typography
        variant="h5"
        gutterBottom
        sx={{ fontWeight: "bold", color: "#1976d2" }}
      >
        Thiết lập Sao lưu Tự động
      </Typography>
      <Divider sx={{ mb: 3 }} />

      {successfulConnections.length === 0 ? (
        <Alert severity="warning">
          Chưa có kết nối nào thành công. Vui lòng kiểm tra kết nối ở tab{" "}
          <b>Chủ động</b> trước.
        </Alert>
      ) : (
        <Stack spacing={4}>
          {/* PHẦN 1: CHỌN SERVER */}
          <Box>
            <Typography
              variant="subtitle1"
              gutterBottom
              sx={{ display: "flex", alignItems: "center", gap: 1 }}
            >
              <StorageIcon color="primary" /> 1. Chọn Server nguồn
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <TextField
                select
                fullWidth
                value={selectedServer?.id || ""}
                onChange={handleServerChange}
                SelectProps={{ native: true }}
              >
                <option value="" disabled>
                  -- Chọn server --
                </option>
                {successfulConnections.map((conn) => (
                  <option key={conn.id} value={conn.id}>
                    {conn.displayName}
                  </option>
                ))}
              </TextField>
              <IconButton
                color="primary"
                onClick={() => setActiveTab(0)} // Giả sử Tab Chủ động là index 0
                sx={{
                  bgcolor: "rgba(25, 118, 210, 0.04)",
                  border: "1px solid",
                  borderColor: "primary.main",
                  borderRadius: 1,
                }}
                title="Thêm kết nối mới"
              >
                <AddIcon />
              </IconButton>
            </Box>
          </Box>

          {/* PHẦN 2: CHỌN NHIỀU DATABASE (Chỉ hiện khi đã chọn Server) */}
          {/* 2. Chọn Database (Dùng list DB trả về từ App.jsx) */}
          {selectedServer && (
            <Autocomplete
              multiple
              options={dbList || []}
              loading={isFetching}
              getOptionLabel={(option) => option} // Vì hàm của bạn trả về mảng string
              value={selectedDBs}
              onChange={(_, newValue) => setSelectedDBs(newValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={isFetching ? "Đang tải DB..." : "Chọn Database"}
                />
              )}
            />
          )}

          {/* PHẦN 3: LỊCH TRÌNH */}
          <Box>
            <Typography
              variant="subtitle1"
              gutterBottom
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                fontWeight: "bold",
              }}
            >
              <ScheduleIcon /> 3. Cấu hình lịch trình
            </Typography>

            <Stack spacing={2}>
              <Stack direction="row" spacing={2} alignItems="flex-start">
                {/* Ô nhập con số (1, 2, 3...) */}
                <TextField
                  label="Lặp lại mỗi"
                  type="number"
                  size="small"
                  sx={{ width: 120 }}
                  value={schedule.interval}
                  onChange={(e) =>
                    setSchedule({ ...schedule, interval: e.target.value })
                  }
                />

                {/* Ô chọn Đơn vị: Giờ hoặc Ngày */}
                <TextField
                  select
                  label="Đơn vị"
                  size="small"
                  sx={{ width: 120 }}
                  value={schedule.type}
                  onChange={(e) =>
                    setSchedule({ ...schedule, type: e.target.value })
                  }
                  SelectProps={{ native: true }}
                >
                  <option value="hour">Giờ</option>
                  <option value="day">Ngày</option>
                </TextField>

                {/* Chỉ hiện ô chọn Giờ bắt đầu nếu chọn loại là "Ngày" */}
                {schedule.type === "day" && (
                  <TextField
                    label="Vào lúc"
                    type="time"
                    size="small"
                    sx={{ width: 150 }}
                    value={schedule.time}
                    onChange={(e) =>
                      setSchedule({ ...schedule, time: e.target.value })
                    }
                    InputLabelProps={{ shrink: true }}
                  />
                )}
              </Stack>

              <Typography variant="caption" color="text.secondary">
                {schedule.type === "day"
                  ? `Hệ thống sẽ backup ${schedule.interval} ngày một lần, vào lúc ${schedule.time}.`
                  : `Hệ thống sẽ tự động backup cứ sau mỗi ${schedule.interval} giờ.`}
              </Typography>
            </Stack>
          </Box>

          <Button
            variant="contained"
            size="large"
            fullWidth
            onClick={handleSaveConfig}
            disabled={!selectedServer || selectedDBs.length === 0}
          >
            Lưu & Kích hoạt Tự động
          </Button>
        </Stack>
      )}
    </Box>
  );
};
