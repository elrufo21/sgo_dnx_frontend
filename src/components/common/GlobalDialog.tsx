import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  CircularProgress,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { Save, X } from "lucide-react";
import { useDialogStore } from "@/store/app/dialog.store";

export function GlobalDialog() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const {
    open,
    title,
    content,
    confirmText,
    cancelText,
    maxWidth,
    fullWidth,
    disableBackdropClose,
    disableClose,
    hideCancelButton,
    mobileFullScreen,
    mobileActions,
    loading,
    data,
    onConfirm,
    onCancel,
    closeDialog,
    setLoading,
    setData,
  } = useDialogStore();

  const handleClose = (_e?: unknown, reason?: string) => {
    if (disableClose) return;
    if (
      disableBackdropClose &&
      (reason === "backdropClick" || reason === "escapeKeyDown")
    )
      return;
    onCancel?.();
    closeDialog();
  };

  const handleConfirm = async () => {
    if (!onConfirm) return closeDialog();
    let shouldResetData = true;
    try {
      setLoading(true);
      const shouldClose = await onConfirm(data);
      if (shouldClose === false) {
        shouldResetData = false;
        return;
      }
      closeDialog();
    } catch (error) {
      shouldResetData = false;
      console.error("Dialog confirm failed", error);
    } finally {
      setLoading(false);
      if (shouldResetData) {
        setData(null);
      }
    }
  };

  const showTitleActionsOnMobile = isMobile && mobileActions !== null;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth={fullWidth}
      fullScreen={isMobile && mobileFullScreen}
      maxWidth={maxWidth}
      disableEscapeKeyDown={disableClose || disableBackdropClose}
      scroll="paper"
      PaperProps={{
        sx: isMobile
          ? {
              width: "calc(100% - 16px)",
              maxHeight: "calc(100dvh - 16px)",
              m: 1,
            }
          : undefined,
      }}
    >
      {title || showTitleActionsOnMobile ? (
        <DialogTitle sx={showTitleActionsOnMobile ? { py: 1.25, px: 2 } : undefined}>
          {showTitleActionsOnMobile ? (
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
              <Box sx={{ fontWeight: 600, fontSize: "1rem", minWidth: 0, pr: 1 }}>
                {title}
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", justifyContent: "flex-end" }}>
                {mobileActions}
                {!hideCancelButton && (
                  <IconButton
                    onClick={handleClose}
                    disabled={loading}
                    size="small"
                    aria-label={cancelText}
                    title={cancelText}
                    sx={{
                      width: 36,
                      height: 36,
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 1.5,
                    }}
                  >
                    <X size={16} />
                  </IconButton>
                )}
                {onConfirm && (
                  <Button
                    onClick={handleConfirm}
                    variant="contained"
                    disabled={loading}
                    size="small"
                    aria-label={confirmText}
                    sx={{ minWidth: 36, width: 36, px: 0 }}
                  >
                    {loading ? <CircularProgress size={16} /> : <Save size={16} />}
                  </Button>
                )}
              </Box>
            </Box>
          ) : (
            title
          )}
        </DialogTitle>
      ) : null}
      <DialogContent dividers sx={isMobile ? { p: 2 } : undefined}>
        {content}
      </DialogContent>
      {!showTitleActionsOnMobile ? (
        <DialogActions
        sx={
          isMobile
            ? {
                px: 2,
                py: 1.5,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 1,
                flexWrap: "wrap",
              }
            : undefined
        }
      >
        {isMobile && mobileActions ? mobileActions : null}
        {!hideCancelButton && (
          <Button onClick={handleClose} disabled={loading}>
            {cancelText}
          </Button>
        )}
        {onConfirm && (
          <Button
            onClick={handleConfirm}
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={18} /> : undefined}
          >
            {confirmText}
          </Button>
        )}
      </DialogActions>
      ) : null}
    </Dialog>
  );
}
