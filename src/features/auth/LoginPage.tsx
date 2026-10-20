import { useRef, useState, type KeyboardEvent } from "react";
import { BarChart3, Eye, EyeOff, Lock, User } from "lucide-react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { Controller, useForm } from "react-hook-form";
import { useNavigate } from "react-router";

import { HookForm } from "@/components/forms/HookForm";
import { useAuthStore } from "@/store/auth/auth.store";

type LoginFormValues = {
  username: string;
  password: string;
};

export function LoginPage() {
  const navigate = useNavigate();
  const redirectTo = "/sales/html_capture/new";

  const login = useAuthStore((state) => state.login);
  const loading = useAuthStore((state) => state.loading);
  const error = useAuthStore((state) => state.error);

  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const passwordInputRef = useRef<HTMLInputElement | null>(null);

  const formMethods = useForm<LoginFormValues>({
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const handleLoginSubmit = async (values: LoginFormValues) => {
    setFormError(null);

    const success = await login({
      username: values.username.trim(),
      password: values.password.trim(),
    });

    if (success) {
      navigate(redirectTo, { replace: true });
      return;
    }

    const latestError = useAuthStore.getState().error;
    setFormError(
      latestError ?? "No pudimos iniciar sesión, intenta nuevamente.",
    );
  };

  const handleUsernameEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (passwordInputRef.current) {
      passwordInputRef.current.focus();
      return;
    }
    void formMethods.handleSubmit(handleLoginSubmit)();
  };

  const handlePasswordEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    void formMethods.handleSubmit(handleLoginSubmit)();
  };

  const message = formError ?? error;

  return (
    <Box
      sx={{
        minHeight: "100vh",
        px: 2,
        py: 3,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        background:
          "radial-gradient(circle at 0% 0%, rgba(190,24,93,0.28), transparent 32%), radial-gradient(circle at 100% 100%, rgba(127,29,29,0.3), transparent 34%), linear-gradient(135deg, #0b0a10, #12111b 55%, #0a0a0f)",
      }}
    >
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          inset: 0,
          opacity: 0.24,
          pointerEvents: "none",
          backgroundImage:
            "linear-gradient(to right, rgba(244,63,94,0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(244,63,94,0.1) 1px, transparent 1px)",
          backgroundSize: "34px 34px",
        }}
      />

      <Paper
        elevation={0}
        sx={{
          position: "relative",
          width: "100%",
          maxWidth: 1020,
          minHeight: { md: 500 },
          overflow: "hidden",
          borderRadius: "24px",
          border: "1px solid rgba(225,29,72,0.6)",
          background:
            "linear-gradient(135deg, rgba(23,19,27,0.98), rgba(13,12,19,0.98))",
          boxShadow: "0 24px 70px rgba(2, 6, 23, 0.58)",
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1.08fr 0.92fr" },
        }}
      >
        <Box sx={{ position: "relative", minHeight: { xs: 220, md: 500 } }}>
          <Box
            component="img"
            src="/logo.png"
            alt="Persona revisando reportes de ventas en una laptop"
            sx={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center 42%",
            }}
          />
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(90deg, rgba(10,9,15,0.02) 45%, rgba(15,11,18,0.28) 100%), linear-gradient(0deg, rgba(10,9,15,0.45), transparent 45%)",
            }}
          />
        </Box>

        <Box
          sx={{
            px: { xs: 2.5, sm: 5, md: 5.5 },
            py: { xs: 3.5, sm: 5 },
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background:
              "linear-gradient(165deg, rgba(23,19,27,0.92), rgba(13,12,19,0.98))",
          }}
        >
          <Box sx={{ width: "100%", maxWidth: 390 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
              <Box
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 58,
                  height: 58,
                  flexShrink: 0,
                  borderRadius: "16px",
                  color: "#fff1f2",
                  background: "linear-gradient(135deg, #be123c, #f43f5e)",
                  boxShadow: "0 8px 22px rgba(225,29,72,0.32)",
                }}
              >
                <BarChart3 size={20} />
              </Box>
              <Box>
                <Typography
                  component="h1"
                  sx={{
                    color: "#f8fafc",
                    fontSize: { xs: "2rem", sm: "2.25rem" },
                    fontWeight: 700,
                    lineHeight: 1,
                  }}
                >
                  Bienvenido
                </Typography>
                <Typography
                  sx={{
                    color: "rgba(203, 195, 205, 0.88)",
                    fontSize: "0.95rem",
                    mt: 0.6,
                  }}
                >
                  Ingresa tus credenciales para continuar
                </Typography>
              </Box>
            </Box>

            <HookForm
              methods={formMethods}
              onSubmit={handleLoginSubmit}
              className="mt-7 space-y-3"
            >
              <Controller
                name="username"
                control={formMethods.control}
                rules={{
                  required: "Ingresa usuario",
                  validate: (value) =>
                    value.trim().length > 0 || "Ingresa usuario",
                }}
                render={({ field, fieldState }) => (
                  <TextField
                    fullWidth
                    placeholder="Usuario"
                    autoComplete="one-time-code"
                    value={field.value ?? ""}
                    onChange={(event) => field.onChange(event.target.value)}
                    onBlur={field.onBlur}
                    onKeyDown={handleUsernameEnter}
                    inputRef={field.ref}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                    InputProps={{
                      "data-auto-next": "true",
                      startAdornment: (
                        <InputAdornment position="start">
                          <User size={18} color="rgba(203,195,205,0.72)" />
                        </InputAdornment>
                      ),
                    }}
                    inputProps={{
                      autoComplete: "one-time-code",
                      autoCorrect: "off",
                      autoCapitalize: "off",
                      spellCheck: false,
                      "data-lpignore": "true",
                      "data-1p-ignore": "true",
                      "data-bwignore": "true",
                      "data-form-type": "other",
                    }}
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        height: 54,
                        borderRadius: "12px",
                        color: "#f1edf2",
                        backgroundColor: "rgba(24,22,31,0.74)",
                        "& input": { paddingLeft: "2px" },
                        "& fieldset": {
                          borderColor: "rgba(203,195,205,0.2)",
                        },
                        "&:hover fieldset": {
                          borderColor: "rgba(244,63,94,0.58)",
                        },
                        "&.Mui-focused fieldset": {
                          borderColor: "#f43f5e",
                          boxShadow: "0 0 0 3px rgba(244,63,94,0.2)",
                        },
                      },
                      "& .MuiOutlinedInput-input::placeholder": {
                        color: "rgba(203,195,205,0.7)",
                        opacity: 1,
                      },
                      "& .MuiFormHelperText-root": {
                        mx: 0.5,
                        color: "#fda4af",
                      },
                    }}
                  />
                )}
              />

              <Controller
                name="password"
                control={formMethods.control}
                rules={{
                  required: "Ingresa contraseña",
                  validate: (value) =>
                    value.trim().length > 0 || "Ingresa contraseña",
                }}
                render={({ field, fieldState }) => (
                  <TextField
                    fullWidth
                    type="text"
                    placeholder="Contraseña"
                    autoComplete="one-time-code"
                    value={field.value ?? ""}
                    onChange={(event) => field.onChange(event.target.value)}
                    onBlur={field.onBlur}
                    onKeyDown={handlePasswordEnter}
                    inputRef={(instance) => {
                      field.ref(instance);
                      passwordInputRef.current = instance;
                    }}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                    InputProps={{
                      "data-auto-next": "true",
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            type="button"
                            size="small"
                            aria-label={
                              showPassword
                                ? "Ocultar contraseña"
                                : "Mostrar contraseña"
                            }
                            onClick={() => setShowPassword((prev) => !prev)}
                            edge="end"
                            sx={{ color: "rgba(203,195,205,0.78)" }}
                          >
                            {showPassword ? (
                              <EyeOff size={18} />
                            ) : (
                              <Eye size={18} />
                            )}
                          </IconButton>
                        </InputAdornment>
                      ),
                      startAdornment: (
                        <InputAdornment position="start">
                          <Lock size={18} color="rgba(203,195,205,0.72)" />
                        </InputAdornment>
                      ),
                    }}
                    inputProps={{
                      autoComplete: "one-time-code",
                      autoCorrect: "off",
                      autoCapitalize: "off",
                      spellCheck: false,
                      ...(showPassword
                        ? {}
                        : { style: { WebkitTextSecurity: "disc" } }),
                      "data-lpignore": "true",
                      "data-1p-ignore": "true",
                      "data-bwignore": "true",
                      "data-form-type": "other",
                    }}
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        height: 54,
                        borderRadius: "12px",
                        color: "#f1edf2",
                        marginTop: 1,
                        backgroundColor: "rgba(24,22,31,0.74)",
                        "& input": { paddingLeft: "2px" },
                        "& fieldset": {
                          borderColor: "rgba(203,195,205,0.2)",
                        },
                        "&:hover fieldset": {
                          borderColor: "rgba(244,63,94,0.58)",
                        },
                        "&.Mui-focused fieldset": {
                          borderColor: "#f43f5e",
                          boxShadow: "0 0 0 3px rgba(244,63,94,0.2)",
                        },
                      },
                      "& .MuiOutlinedInput-input::placeholder": {
                        color: "rgba(203,195,205,0.7)",
                        opacity: 1,
                      },
                      "& .MuiFormHelperText-root": {
                        mx: 0.5,
                        color: "#fda4af",
                      },
                    }}
                  />
                )}
              />

              {message && (
                <Box
                  sx={{
                    borderRadius: "10px",
                    border: "1px solid rgba(244,63,94,0.45)",
                    backgroundColor: "rgba(127,29,29,0.35)",
                    color: "#fecdd3",
                    px: 1.5,
                    py: 1,
                    fontSize: "0.875rem",
                  }}
                >
                  {message}
                </Box>
              )}

              <Button
                type="submit"
                disabled={loading}
                fullWidth
                sx={{
                  mt: 2,
                  height: 54,
                  borderRadius: "12px",
                  textTransform: "none",
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  color: "#f8fafc",
                  background: "linear-gradient(100deg, #9f1239, #e11d48 58%, #ef4444)",
                  boxShadow: "0 10px 24px rgba(190,24,93,0.3)",
                  "&:hover": {
                    background: "linear-gradient(100deg, #881337, #be123c 58%, #dc2626)",
                  },
                  "&.Mui-disabled": {
                    color: "rgba(248,250,252,0.8)",
                    background:
                      "linear-gradient(100deg, rgba(159,18,57,0.68), rgba(225,29,72,0.68) 58%, rgba(239,68,68,0.68))",
                  },
                }}
              >
                {loading ? "Ingresando..." : "Ingresar"}
              </Button>
            </HookForm>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}

export default LoginPage;
