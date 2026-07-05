CREATE PROC [dbo].[uspIngresarProducto]      
 @Data VARCHAR(MAX)      
AS      
BEGIN      
    SET NOCOUNT ON;    
    
    DECLARE @Id NUMERIC(20),    
            @IdSubLinea NUMERIC(20),                  
            @ProductoCodigo VARCHAR(300),                  
            @ProductoNombre VARCHAR(300),                         
            @ProductoUM VARCHAR(60),                  
            @ProductoCosto DECIMAL(18,4),                  
            @ProductoVenta DECIMAL(18,2),                  
            @ProductoVentaB DECIMAL(18,2),                  
            @ProductoCantidad DECIMAL(18,2),                  
            @ProductoEstado VARCHAR(60),                  
            @ProductoUsuario VARCHAR(60),                  
            @ProductoImagen VARCHAR(MAX),                  
            @ValorCritico DECIMAL(18,2),              
            @AplicaINV NVARCHAR(1)    
    
    DECLARE @posOpen INT = 0,     
            @posClose INT = 0    
    
    DECLARE @cabecera VARCHAR(MAX),     
            @detalleUM VARCHAR(MAX)    
    
    IF CHARINDEX('[', @Data) > 0 AND CHARINDEX(']', @Data) > 0    
    BEGIN    
        SET @posOpen = CHARINDEX('[', @Data)    
        SET @posClose = CHARINDEX(']', @Data)    
    
        SET @cabecera = SUBSTRING(@Data, 1, @posOpen - 1)    
        SET @detalleUM = SUBSTRING(@Data, @posOpen + 1, @posClose - @posOpen - 1)    
    END    
    ELSE    
    BEGIN    
        SET @cabecera = @Data    
        SET @detalleUM = ''    
    END    
    
    DECLARE @pos1 INT,@pos2 INT,@pos3 INT,@pos4 INT,@pos5 INT,@pos6 INT,    
            @pos7 INT,@pos8 INT,@pos9 INT,@pos10 INT,@pos11 INT,    
            @pos12 INT,@pos13 INT,@pos14 INT      
    
    SET @cabecera = LTRIM(RTRIM(@cabecera))    
    
    SET @pos1=CHARINDEX('|',@cabecera,0)        
    SET @pos2=CHARINDEX('|',@cabecera,@pos1+1)        
    SET @pos3=CHARINDEX('|',@cabecera,@pos2+1)        
    SET @pos4=CHARINDEX('|',@cabecera,@pos3+1)        
    SET @pos5=CHARINDEX('|',@cabecera,@pos4+1)      
    SET @pos6=CHARINDEX('|',@cabecera,@pos5+1)        
    SET @pos7=CHARINDEX('|',@cabecera,@pos6+1)        
    SET @pos8=CHARINDEX('|',@cabecera,@pos7+1)       
    SET @pos9=CHARINDEX('|',@cabecera,@pos8+1)        
    SET @pos10=CHARINDEX('|',@cabecera,@pos9+1)        
    SET @pos11=CHARINDEX('|',@cabecera,@pos10+1)      
    SET @pos12=CHARINDEX('|',@cabecera,@pos11+1)      
    SET @pos13=CHARINDEX('|',@cabecera,@pos12+1)      
    SET @pos14=LEN(@cabecera)+1        
    
    SET @Id=CONVERT(NUMERIC(20),SUBSTRING(@cabecera,1,@pos1-1))        
    SET @IdSubLinea=CONVERT(NUMERIC(20),SUBSTRING(@cabecera,@pos1+1,@pos2-@pos1-1))        
    SET @ProductoCodigo=SUBSTRING(@cabecera,@pos2+1,@pos3-@pos2-1)        
    SET @ProductoNombre=SUBSTRING(@cabecera,@pos3+1,@pos4-@pos3-1)        
    SET @ProductoUM=SUBSTRING(@cabecera,@pos4+1,@pos5-@pos4-1)        
    SET @ProductoCosto=CONVERT(DECIMAL(18,4),SUBSTRING(@cabecera,@pos5+1,@pos6-@pos5-1))      
    SET @ProductoVenta=CONVERT(DECIMAL(18,2),SUBSTRING(@cabecera,@pos6+1,@pos7-@pos6-1))      
    SET @ProductoVentaB=CONVERT(DECIMAL(18,2),SUBSTRING(@cabecera,@pos7+1,@pos8-@pos7-1))        
    SET @ProductoCantidad=CONVERT(DECIMAL(18,2),SUBSTRING(@cabecera,@pos8+1,@pos9-@pos8-1))        
    SET @ProductoEstado=SUBSTRING(@cabecera,@pos9+1,@pos10-@pos9-1)        
    SET @ProductoUsuario=SUBSTRING(@cabecera,@pos10+1,@pos11-@pos10-1)      
    SET @ProductoImagen=SUBSTRING(@cabecera,@pos11+1,@pos12-@pos11-1)      
    SET @ValorCritico=CONVERT(DECIMAL(18,2),SUBSTRING(@cabecera,@pos12+1,@pos13-@pos12-1))      
    SET @AplicaINV=SUBSTRING(@cabecera,@pos13+1,@pos14-@pos13-1)    
    
    DECLARE @IdProductoFinal NUMERIC(20)    
    
    IF(@Id=0)      
    BEGIN      
        IF EXISTS(SELECT 1 FROM Producto WHERE ProductoCodigo=@ProductoCodigo)         
        BEGIN        
            SELECT 'existe Codigo'         
            RETURN    
        END      
    
        INSERT INTO Producto    
        VALUES(@IdSubLinea,@ProductoCodigo,@ProductoNombre,    
               @ProductoUM,@ProductoCosto,@ProductoVenta,@ProductoVentaB,    
               @ProductoCantidad,'ACTIVO',@ProductoUsuario,GETDATE(),    
               @ProductoImagen,@ValorCritico,@AplicaINV)                  
    
        SET @IdProductoFinal = SCOPE_IDENTITY()    
    
        IF(@AplicaINV='S')          
        BEGIN                  
            INSERT INTO Kardex     
            VALUES(@IdProductoFinal,GETDATE(),    
            'Nuevo Registro','Nuevo Registro',0,    
            @ProductoCantidad,0,@ProductoCosto,@ProductoCantidad,    
            'INGRESO',@ProductoUsuario)                
        END      
  
        IF LTRIM(RTRIM(@detalleUM)) <> ''    
        BEGIN    
            DECLARE @item VARCHAR(MAX), @pos INT    
  
            WHILE LEN(@detalleUM) > 0    
            BEGIN    
                SET @pos = CHARINDEX(';', @detalleUM)    
  
                IF @pos > 0    
                BEGIN    
                    SET @item = SUBSTRING(@detalleUM, 1, @pos - 1)    
                    SET @detalleUM = SUBSTRING(@detalleUM, @pos + 1, LEN(@detalleUM))    
                END    
                ELSE    
                BEGIN    
                    SET @item = @detalleUM    
                    SET @detalleUM = ''    
                END    
  
                IF LTRIM(RTRIM(@item)) <> ''    
                BEGIN    
                    DECLARE @u1 INT,@u2 INT,@u3 INT,@u4 INT,@u5 INT    
                    DECLARE @PrecioCostoUM VARCHAR(60), @UnidadImagenUM VARCHAR(MAX)    
  
                    SET @u1 = CHARINDEX('|', @item)    
                    SET @u2 = CHARINDEX('|', @item, @u1 + 1)    
                    SET @u3 = CHARINDEX('|', @item, @u2 + 1)    
                    SET @u4 = CHARINDEX('|', @item, @u3 + 1)    
                    SET @u5 = CHARINDEX('|', @item, @u4 + 1)    
  
                    IF @u1 > 0 AND @u2 > 0 AND @u3 > 0 AND @u4 > 0    
                    BEGIN    
                        IF @u5 > 0    
                        BEGIN    
                            SET @PrecioCostoUM = SUBSTRING(@item, @u4 + 1, @u5 - @u4 - 1)    
                            SET @UnidadImagenUM = SUBSTRING(@item, @u5 + 1, LEN(@item))    
                        END    
                        ELSE    
                        BEGIN    
                            SET @PrecioCostoUM = SUBSTRING(@item, @u4 + 1, LEN(@item))    
                            SET @UnidadImagenUM = ''    
                        END    
    
                        INSERT INTO UnidadMedida    
                        (IdProducto, UMDescripcion, ValorUM, PrecioVenta, PrecioVentaB, PrecioCosto, unidadImagen)    
                        VALUES    
                        (    
                            @IdProductoFinal,    
                            SUBSTRING(@item, 1, @u1 - 1),    
                            CONVERT(DECIMAL(18,2), SUBSTRING(@item, @u1 + 1, @u2 - @u1 - 1)),    
                            CONVERT(DECIMAL(18,2), SUBSTRING(@item, @u2 + 1, @u3 - @u2 - 1)),    
                            CONVERT(DECIMAL(18,2), SUBSTRING(@item, @u3 + 1, @u4 - @u3 - 1)),    
                            CONVERT(DECIMAL(18,2), @PrecioCostoUM),    
                            NULLIF(LTRIM(RTRIM(ISNULL(@UnidadImagenUM, ''))), '')    
                        )    
                    END    
                END    
            END    
        END    
    END      
  
    ELSE      
    BEGIN      
        IF EXISTS(SELECT 1 FROM Producto     
                  WHERE ProductoCodigo=@ProductoCodigo     
                  AND IdProducto<>@Id)         
        BEGIN        
            SELECT 'existe Codigo'         
            RETURN    
        END      
    
        DECLARE @CantAnt DECIMAL(18,4)    
        SET @CantAnt=(SELECT ProductoCantidad FROM Producto WHERE IdProducto=@Id)    
    
        UPDATE Producto SET      
            IdSubLinea = @IdSubLinea,      
            ProductoCodigo = @ProductoCodigo,      
            ProductoNombre = @ProductoNombre,      
            ProductoUM = @ProductoUM,      
            ProductoCosto = @ProductoCosto,      
            ProductoVenta = @ProductoVenta,      
            ProductoVentaB = @ProductoVentaB,      
            ProductoCantidad = @ProductoCantidad,      
            ProductoEstado = @ProductoEstado,      
            ProductoUsuario = @ProductoUsuario,      
            ProductoFecha = GETDATE(),      
            ProductoImagen = @ProductoImagen,      
            ValorCritico = @ValorCritico,      
            AplicaINV = @AplicaINV      
        WHERE IdProducto = @Id      
    
        SET @IdProductoFinal = @Id    
    
        IF(@AplicaINV='S')          
        BEGIN                  
            INSERT INTO Kardex     
            VALUES(@Id,GETDATE(),    
            'Edita Producto','Edita Producto',    
          @CantAnt,0,0,@ProductoCosto,@ProductoCantidad,    
            'INGRESO',@ProductoUsuario)                  
        END      
    END    
    
    SELECT @IdProductoFinal    
END
