create procedure [dbo].[uspRetornaBoletaPorTicket]  
@ResumenId varchar(80)  
as  
begin  
declare @FechaEmision date  
declare @Dia int,@Mes int,@ANNO int  
set @FechaEmision=(select top 1 r.FechaReferencia from ResumenBoletas r where r.ResumenId=@ResumenId)  

set @Dia=DAY(@FechaEmision)  
set @Mes=MONTH(@FechaEmision)  
set @ANNO=YEAR(@FechaEmision)  

update ResumenBoletas  
set MensajeSunat='NO SE GENERO EL TICKET DE RESPUESTA DE SUNAT'  
where ResumenId=@ResumenId  

update DocumentoVenta  
set EstadoSunat='PENDIENTE'  
WHERE (DAY(DocuEmision)=@Dia AND MONTH(DocuEmision)=@Mes and YEAR(DocuEmision)=@ANNO) and TipoCodigo='03'  

select 'true'  

end  