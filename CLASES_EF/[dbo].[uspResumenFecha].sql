create procedure [dbo].[uspResumenFecha]  
@Data varchar(max)  
as  
begin  
Declare @p1 int,@p2 int  
Declare @fechainicio date,  
        @fechafin date  
Set @Data = LTRIM(RTrim(@Data))  
Set @p1 = CharIndex('|',@Data,0)  
Set @p2= Len(@Data)+1  
Set @fechainicio=convert(date,SUBSTRING(@Data,1,@p1-1))  
Set @fechafin=convert(date,SUBSTRING(@Data,@p1+1,@p2-@p1-1))  
SELECT  
'Id|Compania|FechaEmision|FechaEnvio|Serie|RangoNumeros|SubTotal|IGV|ICBPER|Total|Ticket|CDSunat|HASHCDR|Mensaje|Usuario|RUC|UserSol|ClaveSol|ESTADO|Intentos|TokenApi|IdToken¬100|100|100|100|100|100|110|110|110|100|100|100|100|100|100|100|100|100|100|100|
100|100¬String|String|String|String|String|String|String|String|String|String|String|String|String|String|String|String|String|String|String|String|String|String¬'+   
isnull((select STUFF ((select '¬'+convert(varchar,r.ResumenId)+'|'+convert(varchar,r.CompaniaId)+'|'+  
(IsNull(convert(varchar,r.FechaReferencia,103),''))+'|'+  
(IsNull(convert(varchar,r.FechaEnvio,103),'')+' '+ IsNull(SUBSTRING(convert(varchar,r.FechaEnvio,114),1,8),''))+'|'+  
r.ResumenSerie+'-'+convert(varchar,r.Secuencia)+'|'+r.RangoNumero+'|'+  
CONVERT(VarChar(50),cast(r.SubTotal as money ), 1)+'|'+  
CONVERT(VarChar(50),cast( r.IGV as money ), 1)+'|'+  
CONVERT(VarChar(50),cast( r.ICBPER as money ), 1)+'|'+  
CONVERT(VarChar(50),cast(r.Total as money ), 1)+'|'+  
r.ResumenTiket+'|'+r.CodigoSunat+'|'+r.HASHCDR+'|'+r.MensajeSunat+'|'+  
r.Usuario+'|'+c.CompaniaRUC+'|'+  
c.CompaniaUserSecun+'|'+c.ComapaniaPWD+'|'+r.Estado+'||'+c.TokenApi+'|'+ClienIdToken  
FROM ResumenBoletas r  
inner join Compania c  
on c.CompaniaId=r.CompaniaId  
where (Convert(char(10),r.FechaReferencia,101) BETWEEN @fechainicio AND @fechafin)  
order by r.CompaniaId,r.FechaEnvio asc  
for xml path('')),1,1,'')),'~')  
end  
----------------------------  


select * from ResumenBoletas
order by 1 desc