CREATE   PROCEDURE [dbo].[uspEditarNotaPedido]  
@Data VARCHAR(MAX)  
AS  
BEGIN  
  
SET NOCOUNT ON;  
  
BEGIN TRY  
BEGIN TRAN  
  
DECLARE   
@pos1 INT,  
@pos2 INT,  
@Cabecera VARCHAR(MAX),  
@Detalle VARCHAR(MAX),  
@NotaId INT  
  
SET @pos1 = CHARINDEX('[',@Data,0)  
SET @pos2 = LEN(@Data)+1  
  
SET @Cabecera = SUBSTRING(@Data,1,@pos1-1)  
SET @Detalle  = SUBSTRING(@Data,@pos1+1,@pos2-@pos1-1)  
  
DECLARE  
@p1 INT,@p2 INT,@p3 INT,@p4 INT,@p5 INT,@p6 INT,@p7 INT  
  
SET @p1 = CHARINDEX('|',@Cabecera,0)  
SET @p2 = CHARINDEX('|',@Cabecera,@p1+1)  
SET @p3 = CHARINDEX('|',@Cabecera,@p2+1)  
SET @p4 = CHARINDEX('|',@Cabecera,@p3+1)  
SET @p5 = CHARINDEX('|',@Cabecera,@p4+1)  
SET @p6 = CHARINDEX('|',@Cabecera,@p5+1)  
SET @p7 = LEN(@Cabecera)+1  
  
SET @NotaId = CONVERT(INT,SUBSTRING(@Cabecera,1,@p1-1))  
  
/* DEVOLVER STOCK ANTERIOR */  
  
UPDATE p  
SET p.ProductoCantidad = p.ProductoCantidad + (d.DetalleCantidad * ISNULL(NULLIF(d.ValorUM,0),1))  
FROM Producto p  
INNER JOIN DetallePedido d   
ON p.IdProducto = d.IdProducto  
WHERE d.NotaId = @NotaId  
  
  
/* ACTUALIZA CABECERA */  
  
UPDATE NotaPedido  
SET  
NotaDocu = SUBSTRING(@Cabecera,@p1+1,@p2-@p1-1),  
ClienteId = CONVERT(INT,SUBSTRING(@Cabecera,@p2+1,@p3-@p2-1)),  
NotaFecha = CONVERT(DATETIME,SUBSTRING(@Cabecera,@p3+1,@p4-@p3-1)),  
NotaUsuario = SUBSTRING(@Cabecera,@p4+1,@p5-@p4-1),  
NotaFormaPago = SUBSTRING(@Cabecera,@p5+1,@p6-@p5-1),  
NotaCondicion = SUBSTRING(@Cabecera,@p6+1,@p7-@p6-1)  
WHERE NotaId=@NotaId  
  
  
/* ELIMINA DETALLE ANTERIOR */  
  
DELETE FROM DetallePedido  
WHERE NotaId=@NotaId  
  
  
/* INSERTA NUEVO DETALLE */  
  
DECLARE  
@fila VARCHAR(MAX),  
@c1 INT,@c2 INT,@c3 INT,@c4 INT,@c5 INT,@c6 INT,@c7 INT,@c8 INT,@c9 INT,  
@IdProducto NUMERIC(20),  
@Cantidad DECIMAL(18,2),  
@ValorUM DECIMAL(18,6),  
@ValorUMSegment VARCHAR(60)  
  
WHILE LEN(@Detalle)>0  
BEGIN  
  
SET @c1 = CHARINDEX(';',@Detalle)  
  
IF @c1=0  
BEGIN  
 SET @fila=@Detalle  
 SET @Detalle=''  
END  
ELSE  
BEGIN  
 SET @fila=SUBSTRING(@Detalle,1,@c1-1)  
 SET @Detalle=SUBSTRING(@Detalle,@c1+1,LEN(@Detalle))  
END  
  
  
SET @c1 = CHARINDEX('|',@fila,0)  
SET @c2 = CHARINDEX('|',@fila,@c1+1)  
SET @c3 = CHARINDEX('|',@fila,@c2+1)  
SET @c4 = CHARINDEX('|',@fila,@c3+1)  
SET @c5 = CHARINDEX('|',@fila,@c4+1)  
SET @c6 = CHARINDEX('|',@fila,@c5+1)  
SET @c7 = CHARINDEX('|',@fila,@c6+1)  
SET @c8 = CHARINDEX('|',@fila,@c7+1)  
IF @c8=0 SET @c8 = LEN(@fila)+1  
SET @c9 = CHARINDEX('|',@fila,@c8+1)  
IF @c9=0 SET @c9 = LEN(@fila)+1  
  
  
SET @IdProducto = CONVERT(NUMERIC,SUBSTRING(@fila,1,@c1-1))  
SET @Cantidad   = CONVERT(DECIMAL,SUBSTRING(@fila,@c1+1,@c2-@c1-1))  
SET @ValorUM = 1  
SET @ValorUMSegment = ''  
IF @c8 < LEN(@fila)  
BEGIN  
 SET @ValorUMSegment = LTRIM(RTRIM(SUBSTRING(@fila,@c8+1,@c9-@c8-1)))  
END  
IF ISNUMERIC(REPLACE(@ValorUMSegment,',','.')) = 1  
BEGIN  
 SET @ValorUM = CONVERT(DECIMAL(18,6), REPLACE(@ValorUMSegment,',','.'))  
 IF @ValorUM<=0 SET @ValorUM=1  
END  
  
  
INSERT INTO DetallePedido  
(  
NotaId,  
IdProducto,  
DetalleCantidad,  
DetalleUm,  
DetalleDescripcion,  
DetalleCosto,  
DetallePrecio,  
DetalleImporte,  
DetalleEstado,  
ValorUM  
)  
VALUES  
(  
@NotaId,  
@IdProducto,  
@Cantidad,  
SUBSTRING(@fila,@c2+1,@c3-@c2-1),  
SUBSTRING(@fila,@c3+1,@c4-@c3-1),  
CONVERT(DECIMAL,SUBSTRING(@fila,@c4+1,@c5-@c4-1)),  
CONVERT(DECIMAL,SUBSTRING(@fila,@c5+1,@c6-@c5-1)),  
CONVERT(DECIMAL,SUBSTRING(@fila,@c6+1,@c7-@c6-1)),  
SUBSTRING(@fila,@c7+1,@c8-@c7-1),  
@ValorUM  
)  
  
  
/* DESCONTAR STOCK NUEVO */  
  
UPDATE Producto  
SET ProductoCantidad = ProductoCantidad - (@Cantidad * @ValorUM)  
WHERE IdProducto = @IdProducto  
  
  
END  
  
  
COMMIT TRAN  
  
SELECT 'UPDATED'  
  
END TRY  
BEGIN CATCH  
  
ROLLBACK TRAN  
  
SELECT ERROR_MESSAGE() AS Error  
  
END CATCH  
  
END  
