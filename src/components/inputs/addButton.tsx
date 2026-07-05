import { Button, type ButtonProps } from "@mui/material";
import { type ReactNode } from "react";

export interface ButtonComponentProps extends ButtonProps {
  icon?: ReactNode;
  iconPosition?: "start" | "end";
}

const ButtonComponent = ({
  children,
  icon,
  iconPosition = "start",
  variant = "contained",
  color = "primary",
  size = "medium",
  fullWidth = false,
  ...rest
}: ButtonComponentProps) => {
  return (
    <Button
      variant={variant}
      color={color}
      size={size}
      fullWidth={fullWidth}
      startIcon={iconPosition === "start" ? icon : undefined}
      endIcon={iconPosition === "end" ? icon : undefined}
      {...rest}
    >
      {children}
    </Button>
  );
};

export default ButtonComponent;
