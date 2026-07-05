import { useRef, useState, type KeyboardEvent } from "react";
import { Eye, EyeOff, LogIn } from "lucide-react";
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
  const redirectTo = "/sales/pos";

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
          "radial-gradient(circle at 20% 20%, #102655 0%, #081633 45%, #040d24 100%)",
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
            "linear-gradient(to right, rgba(59,130,246,0.14) 1px, transparent 1px), linear-gradient(to bottom, rgba(59,130,246,0.14) 1px, transparent 1px)",
          backgroundSize: "34px 34px",
        }}
      />

      <Paper
        elevation={0}
        sx={{
          position: "relative",
          width: "100%",
          maxWidth: 840,
          overflow: "hidden",
          borderRadius: "18px",
          border: "1px solid rgba(148,163,184,0.18)",
          background:
            "linear-gradient(135deg, rgba(16,31,64,0.94), rgba(10,24,55,0.94))",
          boxShadow: "0 16px 42px rgba(2, 6, 23, 0.42)",
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
        }}
      >
        <Box sx={{ position: "relative", minHeight: { xs: 210, md: 420 } }}>
          <Box
            component="img"
            src="/logo.png"
            alt="Marca del sistema"
            sx={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              inset: 0,
            }}
          />
        </Box>

        <Box
          sx={{
            px: { xs: 2.5, sm: 3.5 },
            py: { xs: 3, sm: 3.5 },
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background:
              "linear-gradient(165deg, rgba(14,30,64,0.82), rgba(9,22,49,0.92))",
          }}
        >
          <Box sx={{ width: "100%", maxWidth: 340 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
              <Box
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: "10px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#e0f2fe",
                  background: "linear-gradient(135deg, #3b82f6, #06b6d4)",
                  boxShadow: "0 6px 16px rgba(14,165,233,0.35)",
                }}
              >
                <LogIn size={16} />
              </Box>
              <Box>
                <Typography
                  component="h1"
                  sx={{
                    color: "#f8fafc",
                    fontSize: "2.25rem",
                    fontWeight: 700,
                    lineHeight: 1,
                  }}
                >
                  Bienvenido
                </Typography>
                <Typography
                  sx={{
                    color: "rgba(148,163,184,0.95)",
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
              className="mt-5 space-y-3"
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
                    InputProps={{ "data-auto-next": "true" }}
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
                        height: 44,
                        borderRadius: "10px",
                        color: "#e2e8f0",
                        backgroundColor: "rgba(30,41,59,0.5)",
                        "& fieldset": {
                          borderColor: "rgba(148,163,184,0.22)",
                        },
                        "&:hover fieldset": {
                          borderColor: "rgba(56,189,248,0.5)",
                        },
                        "&.Mui-focused fieldset": {
                          borderColor: "#38bdf8",
                          boxShadow: "0 0 0 3px rgba(56,189,248,0.22)",
                        },
                      },
                      "& .MuiOutlinedInput-input::placeholder": {
                        color: "rgba(148,163,184,0.95)",
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
                            sx={{ color: "rgba(148,163,184,0.95)" }}
                          >
                            {showPassword ? (
                              <EyeOff size={18} />
                            ) : (
                              <Eye size={18} />
                            )}
                          </IconButton>
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
                        height: 44,
                        borderRadius: "10px",
                        color: "#e2e8f0",
                        marginTop: 1,
                        backgroundColor: "rgba(30,41,59,0.5)",
                        "& fieldset": {
                          borderColor: "rgba(148,163,184,0.22)",
                        },
                        "&:hover fieldset": {
                          borderColor: "rgba(56,189,248,0.5)",
                        },
                        "&.Mui-focused fieldset": {
                          borderColor: "#38bdf8",
                          boxShadow: "0 0 0 3px rgba(56,189,248,0.22)",
                        },
                      },
                      "& .MuiOutlinedInput-input::placeholder": {
                        color: "rgba(148,163,184,0.95)",
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
                  height: 40,
                  borderRadius: "10px",
                  textTransform: "none",
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  color: "#f8fafc",
                  background: "linear-gradient(90deg, #3b82f6, #06b6d4)",
                  boxShadow: "0 8px 18px rgba(14, 165, 233, 0.28)",
                  "&:hover": {
                    background: "linear-gradient(90deg, #2563eb, #0891b2)",
                  },
                  "&.Mui-disabled": {
                    color: "rgba(248,250,252,0.8)",
                    background:
                      "linear-gradient(90deg, rgba(59,130,246,0.65), rgba(6,182,212,0.65))",
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
