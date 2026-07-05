CREATE PROCEDURE [dbo].[uspListarProducto]  
  @Estado VARCHAR(20) = NULL  
AS  
BEGIN  
  SET NOCOUNT ON;  
  
  ;WITH filas AS  
  (  
    -- BASE  
    SELECT  
      p.IdProducto AS SortId,  
      1 AS SortTipo,  
      '¬' +  
      ISNULL(CONVERT(VARCHAR(20), p.IdProducto), '0') + '|' +  
      ISNULL(CONVERT(VARCHAR(20), p.IdSubLinea), '0') + '|' +  
      ISNULL(p.ProductoCodigo, '') + '|' +  
      ISNULL(p.ProductoNombre, '') + '|' +  
      ISNULL(p.ProductoUM, '') + '|' +  
      ISNULL(CONVERT(VARCHAR(50), p.ProductoCosto), '0') + '|' +  
      ISNULL(CONVERT(VARCHAR(50), p.ProductoVenta), '0') + '|' +  
      ISNULL(CONVERT(VARCHAR(50), p.ProductoVentaB), '0') + '|' +  
      ISNULL(CONVERT(VARCHAR(50), p.ProductoCantidad), '0') + '|' +  
      ISNULL(p.ProductoEstado, '') + '|' +  
      ISNULL(p.ProductoUsuario, '') + '|' +  
      ISNULL(CONVERT(VARCHAR(10), p.ProductoFecha, 23), '') + '|' +  
      ISNULL(p.ProductoImagen, '') + '|' +  
      ISNULL(CONVERT(VARCHAR(50), p.ValorCritico), '0') + '|' +  
      ISNULL(p.AplicaINV, '') AS RowText  
    FROM Producto p  
    WHERE (@Estado IS NULL OR p.ProductoEstado = @Estado)  
  
    UNION ALL  
  
    -- UNIDAD ALTERNA  
    SELECT  
      p.IdProducto AS SortId,  
      2 AS SortTipo,  
      '¬' +  
      ISNULL(CONVERT(VARCHAR(20), p.IdProducto), '0') + '|' +  
      ISNULL(CONVERT(VARCHAR(20), p.IdSubLinea), '0') + '|' +  
      ISNULL(p.ProductoCodigo, '') + '|' +  
      ISNULL(p.ProductoNombre, '') + '|' +  
      ISNULL(u.UMDescripcion, '') + '|' +  
      ISNULL(CONVERT(VARCHAR(50), u.PrecioCosto), '0') + '|' +  
      ISNULL(CONVERT(VARCHAR(50), u.PrecioVenta), '0') + '|' +  
      ISNULL(CONVERT(VARCHAR(50), u.PrecioVentaB), '0') + '|' +  
      ISNULL(
        CASE
          WHEN ISNULL(u.ValorUM, 0) = 0 THEN '0'
          ELSE CONVERT(VARCHAR, CAST((p.ProductoCantidad / u.ValorUM) AS MONEY), 1)
        END,
      '0') + '|' +  
      ISNULL(p.ProductoEstado, '') + '|' +  
      ISNULL(p.ProductoUsuario, '') + '|' +  
      ISNULL(CONVERT(VARCHAR(10), p.ProductoFecha, 23), '') + '|' +  
      ISNULL(u.unidadImagen, ISNULL(p.ProductoImagen, '')) + '|' +  
      ISNULL(CONVERT(VARCHAR(50), p.ValorCritico), '0') + '|' +  
      ISNULL(p.AplicaINV, '') AS RowText  
    FROM UnidadMedida u  
    INNER JOIN Producto p ON p.IdProducto = u.IdProducto  
    WHERE (@Estado IS NULL OR p.ProductoEstado = @Estado)  
  )  
  SELECT ISNULL(  
    STUFF(  
      (  
        SELECT f.RowText  
        FROM filas f  
        ORDER BY f.SortId DESC, f.SortTipo ASC  
        FOR XML PATH(''), TYPE  
      ).value('.', 'VARCHAR(MAX)'),  
      1, 1, ''  
    ),  
    '~'  
  ) AS Data;  
END  
