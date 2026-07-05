CREATE PROCEDURE dbo.uspGuardarUnidadMedidaProducto  
(  
    @IdProducto NUMERIC(20),  
    @UMDescripcion VARCHAR(100),  
    @ValorUM DECIMAL(18,2),  
    @PrecioVenta DECIMAL(18,2),  
    @PrecioVentaB DECIMAL(18,2),  
    @PrecioCosto DECIMAL(18,2),  
    @UnidadImagen VARCHAR(MAX) = NULL  
)  
AS  
BEGIN  
    SET NOCOUNT ON;  
  
    DECLARE @IdUm INT;  
   
    SET @UMDescripcion = LTRIM(RTRIM(@UMDescripcion));  
    SET @UnidadImagen = NULLIF(LTRIM(RTRIM(ISNULL(@UnidadImagen, ''))), '');  
  
    SELECT TOP 1 @IdUm = IdUm  
    FROM UnidadMedida  
    WHERE IdProducto = @IdProducto  
    AND UPPER(LTRIM(RTRIM(UMDescripcion))) = UPPER(@UMDescripcion);  
  
    IF @IdUm IS NOT NULL  
    BEGIN  
        UPDATE UnidadMedida  
        SET   
            ValorUM = @ValorUM,  
            PrecioVenta = @PrecioVenta,  
            PrecioVentaB = @PrecioVentaB,  
            PrecioCosto = @PrecioCosto,  
            unidadImagen = @UnidadImagen  
        WHERE IdUm = @IdUm;  
  
        SELECT @IdUm AS IdUm;  
        RETURN;  
    END  
  
    INSERT INTO UnidadMedida  
    (  
        IdProducto,  
        UMDescripcion,  
        ValorUM,  
        PrecioVenta,  
        PrecioVentaB,  
        PrecioCosto,  
        unidadImagen  
    )  
    VALUES  
    (  
        @IdProducto,  
        @UMDescripcion,  
        @ValorUM,  
        @PrecioVenta,  
        @PrecioVentaB,  
        @PrecioCosto,  
        @UnidadImagen  
    );  
  
    SELECT SCOPE_IDENTITY() AS IdUm;  
END
