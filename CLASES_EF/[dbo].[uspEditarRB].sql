create procedure [dbo].[uspEditarRB]  
@Data varchar(max)  
as  
begin  
Declare  @p1 int,@p2 int,  
         @p3 int,@p4 int  
Declare  @ResumenId numeric(38),@CodigoSunat varchar(80),  
         @MensajeSunat varchar(max),@HASHCDR varchar(max)  
Set @Data = LTRIM(RTrim(@Data))  
Set @p1 = CharIndex('|',@Data,0)  
Set @p2 = CharIndex('|',@Data,@p1+1)  
Set @p3 = CharIndex('|',@Data,@p2+1)  
Set @p4= Len(@Data)+1  

Set @ResumenId=convert(numeric(38),SUBSTRING(@Data,1,@p1-1))  
Set @CodigoSunat=SUBSTRING(@Data,@p1+1,@p2-@p1-1)  
Set @MensajeSunat=SUBSTRING(@Data,@p2+1,@p3-@p2-1)  
Set @HASHCDR=SUBSTRING(@Data,@p3+1,@p4-@p3-1)  

update ResumenBoletas  
set CodigoSunat=@CodigoSunat,MensajeSunat=@MensajeSunat,HASHCDR=@HASHCDR  
where ResumenId=@ResumenId  
SELECT 'true'  

end  