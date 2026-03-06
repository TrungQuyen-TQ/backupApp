import React from "react";
import {
  Box,
  TextField,
  Typography,
  Grid,
  InputAdornment,
  IconButton,
  FormControl, // Thêm cái này
  Select,      // Thêm cái này
  MenuItem
} from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

const FormRow = ({ label, name, value, onChange, placeholder, type = "text", options = null }) => {
  const [showPass, setShowPass] = React.useState(false);

  return (
    <Grid container spacing={2} alignItems="center" sx={{ mb: 2.5 }}>
      <Grid item size={{ xs: 3, md: 4 }}>
        <Typography variant="body1" sx={{ fontWeight: 500, color: '#444' }}>
          {label}:
        </Typography>
      </Grid>
      <Grid item size={{ xs: 6, md: 8 }}>
        {options ? (
          // Trường hợp là Dropdown (Select)
          <FormControl fullWidth size="small">
            <Select name={name} value={value} onChange={onChange}>
              {options.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        ) : (
          // Trường hợp là TextField bình thường
          <TextField
            fullWidth
            size="small"
            name={name}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            type={type === "password" && !showPass ? "password" : "text"}
            InputProps={type === "password" ? {
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPass(!showPass)} size="small">
                    {showPass ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            } : undefined}
          />
        )}
      </Grid>
    </Grid>
  );
};

const dbOptions = [
  { label: "SQL Server", value: "sqlserver" },
  { label: "MySQL", value: "mysql" },
  { label: "MongoDB", value: "mongodb" },
  { label: "PostgreSQL", value: "postgresql" },
];
export const ConnectionForm = ({ formData, setFormData }) => {
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <Box sx={{ p: 4 }}>
      <Typography
        variant="subtitle1"
        sx={{
          mb: 3,
          display: "flex",
          alignItems: "center",
          color: "#555",
          fontWeight: "bold",
        }}
      >
        SQL Server Connection Settings
        <Box sx={{ flex: 1, height: "1px", bgcolor: "#e0e0e0", ml: 2 }} />
      </Typography>

      <FormRow
        label="Server Name"
        name="server"
        value={formData.server}
        onChange={handleChange}
        placeholder="e.g, 192.168.1.100 or sqlserver.domain.com"
      />
      <FormRow
        label="Database Name"
        name="database"
        value={formData.database}
        onChange={handleChange}
        placeholder="Enter database name"
      />
      <FormRow
        label="Database Type"
        name="dbType"
        value={formData.dbType || ''}
        onChange={handleChange}
        options={dbOptions}
      />
      <FormRow
        label="Username"
        name="user"
        value={formData.user}
        onChange={handleChange}
        placeholder="Enter username"
      />
      <FormRow
        label="Password"
        name="password"
        value={formData.password}
        onChange={handleChange}
        placeholder="Enter password"
        type="password"
      />
      <FormRow
        label="Port"
        name="port"
        value={formData.port}
        onChange={handleChange}
        placeholder="e.g, 1433"
      />
    </Box>
  );
};
