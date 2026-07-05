-- 1) Agregar columna
if col_length('dbo.ResumenBoletas', 'CDRBase64') is null
begin
    alter table dbo.ResumenBoletas
    add CDRBase64 varchar(max) null;
end
go

-- 2) Actualizar uspEditarRB
alter procedure [dbo].[uspEditarRB]
@Data varchar(max)
as
begin
    declare @p1 int,@p2 int,@p3 int,@p4 int,@p5 int;
    declare @ResumenId numeric(38),
            @CodigoSunat varchar(80),
            @MensajeSunat varchar(max),
            @HASHCDR varchar(max),
            @CDRBase64 varchar(max);

    set @Data = ltrim(rtrim(@Data));
    set @p1 = charindex('|', @Data, 0);
    set @p2 = charindex('|', @Data, @p1 + 1);
    set @p3 = charindex('|', @Data, @p2 + 1);
    set @p4 = charindex('|', @Data, @p3 + 1);
    set @p5 = len(@Data) + 1;

    if (@p4 = 0) set @p4 = @p5;

    set @ResumenId    = convert(numeric(38), substring(@Data, 1, @p1 - 1));
    set @CodigoSunat  = substring(@Data, @p1 + 1, @p2 - @p1 - 1);
    set @MensajeSunat = substring(@Data, @p2 + 1, @p3 - @p2 - 1);
    set @HASHCDR      = substring(@Data, @p3 + 1, @p4 - @p3 - 1);
    set @CDRBase64    = case when @p4 < @p5 then substring(@Data, @p4 + 1, @p5 - @p4 - 1) else '' end;

    update ResumenBoletas
       set CodigoSunat = @CodigoSunat,
           MensajeSunat = @MensajeSunat,
           HASHCDR = @HASHCDR,
           CDRBase64 = case when isnull(@CDRBase64,'')='' then CDRBase64 else @CDRBase64 end
     where ResumenId = @ResumenId;

    select 'true';
end
go


-- 3) Actualizar uspRetornaBoletaPorTicket
alter procedure [dbo].[uspRetornaBoletaPorTicket]
@ResumenId varchar(80)
as
begin
    declare @FechaEmision date;
    declare @Dia int,@Mes int,@ANNO int;

    set @FechaEmision = (select top 1 r.FechaReferencia from ResumenBoletas r where r.ResumenId=@ResumenId);
    set @Dia = day(@FechaEmision);
    set @Mes = month(@FechaEmision);
    set @ANNO = year(@FechaEmision);

    update ResumenBoletas
       set MensajeSunat='NO SE GENERO EL TICKET DE RESPUESTA DE SUNAT',
           HASHCDR='',
           CDRBase64=''
     where ResumenId=@ResumenId;

    update DocumentoVenta
       set EstadoSunat='PENDIENTE'
     where (day(DocuEmision)=@Dia and month(DocuEmision)=@Mes and year(DocuEmision)=@ANNO)
       and TipoCodigo='03';

    select 'true';
end
go

-- 4) Actualizar uspResumenFecha (incluye TieneCDR y sanitiza '|')
alter procedure [dbo].[uspResumenFecha]
@Data varchar(max)
as
begin
    declare @p1 int,@p2 int;
    declare @fechainicio date,@fechafin date;
    declare @sep char(1);
    set @sep = char(172);

    set @Data = ltrim(rtrim(@Data));
    set @p1 = charindex('|',@Data,0);
    set @p2 = len(@Data)+1;
    set @fechainicio = convert(date,substring(@Data,1,@p1-1));
    set @fechafin = convert(date,substring(@Data,@p1+1,@p2-@p1-1));

    select
    'Id|Compania|FechaEmision|FechaEnvio|Serie|RangoNumeros|SubTotal|IGV|ICBPER|Total|Ticket|CDSunat|HASHCDR|Mensaje|Usuario|RUC|UserSol|ClaveSol|ESTADO|Intentos|TokenApi|IdToken|TieneCDR'
    + @sep +
    '100|100|100|100|100|100|110|110|110|100|100|100|100|100|100|100|100|100|100|100|100|100|80'
    + @sep +
    'String|String|String|String|String|String|String|String|String|String|String|String|String|String|String|String|String|String|String|String|String|String|String'
    + @sep +
    isnull((select stuff((select @sep + convert(varchar,r.ResumenId) + '|' + convert(varchar,r.CompaniaId) + '|' +
    isnull(convert(varchar,r.FechaReferencia,103),'') + '|' +
    (isnull(convert(varchar,r.FechaEnvio,103),'') + ' ' + isnull(substring(convert(varchar,r.FechaEnvio,114),1,8),'')) + '|' +
    r.ResumenSerie + '-' + convert(varchar,r.Secuencia) + '|' + isnull(r.RangoNumero,'') + '|' +
    convert(varchar(50),cast(r.SubTotal as money),1) + '|' +
    convert(varchar(50),cast(r.IGV as money),1) + '|' +
    convert(varchar(50),cast(r.ICBPER as money),1) + '|' +
    convert(varchar(50),cast(r.Total as money),1) + '|' +
    isnull(r.ResumenTiket,'') + '|' +
    replace(isnull(r.CodigoSunat,''),'|',' ') + '|' +
    replace(isnull(r.HASHCDR,''),'|',' ') + '|' +
    replace(isnull(r.MensajeSunat,''),'|',' ') + '|' +
    replace(isnull(r.Usuario,''),'|',' ') + '|' +
    isnull(c.CompaniaRUC,'') + '|' +
    isnull(c.CompaniaUserSecun,'') + '|' +
    isnull(c.ComapaniaPWD,'') + '|' +
    isnull(r.Estado,'') + '||' +
    isnull(c.TokenApi,'') + '|' +
    isnull(c.ClienIdToken,'') + '|' +
    case when isnull(r.CDRBase64,'')='' then 'NO' else 'SI' end
    from ResumenBoletas r
    inner join Compania c on c.CompaniaId=r.CompaniaId
    where r.FechaReferencia between @fechainicio and @fechafin
    order by r.CompaniaId,r.FechaEnvio asc
    for xml path('')),1,1,'')),'~');
end
go
