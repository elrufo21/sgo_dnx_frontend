using System.Collections.Generic;
using BE = BusinessEntities;
using EV = CPEEnvio;
using XM = Xml;
using SG = Signature;
namespace MegaRosita.Capa.Aplicacion
{
    public class CPEConfig
    {
        private XM.CrearXML objXML = new XM.CrearXML();
        private SG.FirmadoRequest objPregunta = new SG.FirmadoRequest();
        private SG.FirmadoResponse objRespuesta = new SG.FirmadoResponse();
        private SG.Signature objSignature = new SG.Signature();
        private EV.ServiceSunat objENV = new EV.ServiceSunat();
        Conexion xconexion = new Conexion();
        public Dictionary<string, string> Envio(BE.CPE CPE)
        {
            Dictionary<string, string> dictionary = null;
            string nomARCHIVO = "";
            string ruta = "";
            string rutaFirma = "";
            string url = "";
            CPE.TOTAL_GRAVADAS = (CPE.TOTAL_GRAVADAS != null ? CPE.TOTAL_GRAVADAS : 0);
            CPE.TOTAL_INAFECTA = (CPE.TOTAL_INAFECTA != null ? CPE.TOTAL_INAFECTA : 0);
            CPE.TOTAL_EXONERADAS = (CPE.TOTAL_EXONERADAS != null ? CPE.TOTAL_EXONERADAS : 0);
            CPE.TOTAL_GRATUITAS = (CPE.TOTAL_GRATUITAS != null ? CPE.TOTAL_GRATUITAS : 0);
            CPE.TOTAL_PERCEPCIONES = (CPE.TOTAL_PERCEPCIONES != null ? CPE.TOTAL_PERCEPCIONES : 0);
            CPE.TOTAL_RETENCIONES = (CPE.TOTAL_RETENCIONES != null ? CPE.TOTAL_RETENCIONES : 0);
            CPE.TOTAL_DETRACCIONES = (CPE.TOTAL_DETRACCIONES != null ? CPE.TOTAL_DETRACCIONES : 0);
            CPE.TOTAL_BONIFICACIONES = (CPE.TOTAL_BONIFICACIONES != null ? CPE.TOTAL_BONIFICACIONES : 0);
            CPE.TOTAL_DESCUENTO = (CPE.TOTAL_DESCUENTO != null ? CPE.TOTAL_DESCUENTO : 0);
            CPE.TOTAL_ICBPER = (CPE.TOTAL_ICBPER != null ? CPE.TOTAL_ICBPER : 0);
            CPE.TOTAL_EXPORTACION = (CPE.TOTAL_EXPORTACION != null ? CPE.TOTAL_EXPORTACION : 0);
            nomARCHIVO = CPE.NRO_DOCUMENTO_EMPRESA + "-" + CPE.COD_TIPO_DOCUMENTO + "-" + CPE.NRO_COMPROBANTE;
            switch (CPE.TIPO_PROCESO)
            {
                case 3:
                    ruta = "\\\\" + xconexion.ServidorIP + "\\ArchivoSistema\\CPE\\BETA\\";
                    rutaFirma = "D:\\CPE\\FIRMABETA\\" + CPE.RUTA_PFX;
                    //url = "https://e-beta.sunat.gob.pe:443/ol-ti-itcpfegem-beta/billService";
                    url = "https://demo-ose.nubefact.com/ol-ti-itcpe/billService?wsdl";
                    if (CPE.COD_TIPO_DOCUMENTO == "01" || CPE.COD_TIPO_DOCUMENTO == "03")
                    {
                        objXML.CPE(CPE, nomARCHIVO, ruta);
                    }
                    else
                    {
                        if (CPE.COD_TIPO_DOCUMENTO == "07")
                        {
                            objXML.CPE_NC(CPE, nomARCHIVO, ruta);
                        }
                        else
                        {
                            if (CPE.COD_TIPO_DOCUMENTO == "08")
                            {
                                objXML.CPE_ND(CPE, nomARCHIVO, ruta);
                            }
                        }
                    }
                    objPregunta.ruta_Firma = rutaFirma;
                    objPregunta.contra_Firma = CPE.CONTRA_FIRMA;
                    objPregunta.ruta_xml = ruta + nomARCHIVO + ".XML";
                    objPregunta.flg_firma = 0;
                    objRespuesta = objSignature.FirmaXMl(objPregunta);
                    dictionary = objENV.Envio(CPE.NRO_DOCUMENTO_EMPRESA, CPE.USUARIO_SOL_EMPRESA, CPE.PASS_SOL_EMPRESA, nomARCHIVO, ruta, url, objRespuesta.DigestValue);
                    break;
                case 2:
                    ruta = "D:\\CPE\\HOMOLOGACION\\";
                    rutaFirma = "D:\\CPE\\FIRMABETA\\" + CPE.RUTA_PFX;
                    url = "https://www.sunat.gob.pe/ol-ti-itcpgem-sqa/billService";
                    if (CPE.COD_TIPO_DOCUMENTO == "01" || CPE.COD_TIPO_DOCUMENTO == "03")
                    {
                        objXML.CPE(CPE, nomARCHIVO, ruta);
                    }
                    else
                    {
                        if (CPE.COD_TIPO_DOCUMENTO == "07")
                        {
                            objXML.CPE_NC(CPE, nomARCHIVO, ruta);
                        }
                        else
                        {
                            if (CPE.COD_TIPO_DOCUMENTO == "08")
                            {
                                objXML.CPE_ND(CPE, nomARCHIVO, ruta);
                            }
                        }
                    }
                    objPregunta.ruta_Firma = rutaFirma;
                    objPregunta.contra_Firma = CPE.CONTRA_FIRMA;
                    objPregunta.ruta_xml = ruta + nomARCHIVO + ".XML";
                    objPregunta.flg_firma = 0;
                    objRespuesta = objSignature.FirmaXMl(objPregunta);
                    dictionary = objENV.Envio(CPE.NRO_DOCUMENTO_EMPRESA, CPE.USUARIO_SOL_EMPRESA, CPE.PASS_SOL_EMPRESA, nomARCHIVO, ruta, url, objRespuesta.DigestValue);
                    break;
                case 1:
                    ruta = "\\\\" + xconexion.ServidorIP + "\\ArchivoSistema\\CPE\\PRODUCCION\\";
                    rutaFirma = "D:\\CPE\\FIRMABETA\\" + CPE.RUTA_PFX;
                    //url = "https://e-factura.sunat.gob.pe/ol-ti-itcpfegem/billService";
                    url = "https://ose.nubefact.com/ol-ti-itcpe/billService?wsdl";
                    if (CPE.COD_TIPO_DOCUMENTO == "01" || CPE.COD_TIPO_DOCUMENTO == "03")
                    {
                        objXML.CPE(CPE, nomARCHIVO, ruta);
                    }
                    else
                    {
                        if (CPE.COD_TIPO_DOCUMENTO == "07")
                        {
                            objXML.CPE_NC(CPE, nomARCHIVO, ruta);
                        }
                        else
                        {
                            if (CPE.COD_TIPO_DOCUMENTO == "08")
                            {
                                objXML.CPE_ND(CPE, nomARCHIVO, ruta);
                            }
                        }
                    }
                    objPregunta.ruta_Firma = rutaFirma;
                    objPregunta.contra_Firma = CPE.CONTRA_FIRMA;
                    objPregunta.ruta_xml = ruta + nomARCHIVO + ".XML";
                    objPregunta.flg_firma = 0;
                    objRespuesta = objSignature.FirmaXMl(objPregunta);
                    dictionary = objENV.Envio(CPE.NRO_DOCUMENTO_EMPRESA, CPE.USUARIO_SOL_EMPRESA, CPE.PASS_SOL_EMPRESA, nomARCHIVO, ruta, url, objRespuesta.DigestValue);
                    break;
            }
            return dictionary;
        }
        public Dictionary<string, string> EnvioResumen(BE.CPE_RESUMEN_BOLETA CPEResumen)
        {
            Dictionary<string, string> dictionary = null;
            string nomARCHIVO = "";
            string ruta = "";
            string rutaFirma = "";
            string url = "";
            nomARCHIVO = CPEResumen.NRO_DOCUMENTO_EMPRESA + "-" + CPEResumen.CODIGO + "-" + CPEResumen.SERIE + "-" + CPEResumen.SECUENCIA;
            switch (CPEResumen.TIPO_PROCESO)
            {
                case 3:
                    ruta = "\\\\" + xconexion.ServidorIP + "\\ArchivoSistema\\CPE\\BETA\\";
                    rutaFirma = "D:\\CPE\\FIRMABETA\\" + CPEResumen.RUTA_PFX;
                    //url = "https://e-beta.sunat.gob.pe:443/ol-ti-itcpfegem-beta/billService";
                    url = "https://demo-ose.nubefact.com/ol-ti-itcpe/billService?wsdl";
                    objXML.ResumenBoleta(CPEResumen, nomARCHIVO, ruta);
                    objPregunta.ruta_Firma = rutaFirma;
                    objPregunta.contra_Firma = CPEResumen.CONTRA_FIRMA;
                    objPregunta.ruta_xml = ruta + nomARCHIVO + ".XML";
                    objPregunta.flg_firma = 0;
                    objRespuesta = objSignature.FirmaXMl(objPregunta);
                    dictionary = objENV.EnvioResumen(CPEResumen.NRO_DOCUMENTO_EMPRESA, CPEResumen.USUARIO_SOL_EMPRESA, CPEResumen.PASS_SOL_EMPRESA, nomARCHIVO, ruta, url, objRespuesta.DigestValue);
                    break;
                case 1:
                    ruta = "\\\\" + xconexion.ServidorIP + "\\ArchivoSistema\\CPE\\PRODUCCION\\";
                    rutaFirma = "D:\\CPE\\FIRMABETA\\" + CPEResumen.RUTA_PFX;
                    //url = "https://e-factura.sunat.gob.pe/ol-ti-itcpfegem/billService";
                    //url = "https://www.sunat.gob.pe/ol-ti-itcpfegem/billService";
                    url = "https://ose.nubefact.com/ol-ti-itcpe/billService?wsdl";
                    objXML.ResumenBoleta(CPEResumen, nomARCHIVO, ruta);
                    objPregunta.ruta_Firma = rutaFirma;
                    objPregunta.contra_Firma = CPEResumen.CONTRA_FIRMA;
                    objPregunta.ruta_xml = ruta + nomARCHIVO + ".XML";
                    objPregunta.flg_firma = 0;
                    objRespuesta = objSignature.FirmaXMl(objPregunta);
                    dictionary = objENV.EnvioResumen(CPEResumen.NRO_DOCUMENTO_EMPRESA, CPEResumen.USUARIO_SOL_EMPRESA, CPEResumen.PASS_SOL_EMPRESA, nomARCHIVO, ruta, url, objRespuesta.DigestValue);
                    break;
            }
            return dictionary;
        }
        public Dictionary<string, string> EnvioBaja(BE.CPE_BAJA CPEBaja)
        {
            Dictionary<string, string> dictionary = null;
            string nomARCHIVO = "";
            string ruta = "";
            string rutaFirma = "";
            string url = "";
            nomARCHIVO = CPEBaja.NRO_DOCUMENTO_EMPRESA + "-" + CPEBaja.CODIGO + "-" + CPEBaja.SERIE + "-" + CPEBaja.SECUENCIA;
            switch (CPEBaja.TIPO_PROCESO)
            {
                case 3:
                    ruta = "\\\\" + xconexion.ServidorIP + "\\ArchivoSistema\\CPE\\BETA\\";
                    rutaFirma = "D:\\CPE\\FIRMA\\" + CPEBaja.RUTA_PFX;
                    //url = "https://e-beta.sunat.gob.pe:443/ol-ti-itcpfegem-beta/billService";
                    url = "https://demo-ose.nubefact.com/ol-ti-itcpe/billService?wsdl";
                    objXML.ResumenBaja(CPEBaja, nomARCHIVO, ruta);
                    objPregunta.ruta_Firma = rutaFirma;
                    objPregunta.contra_Firma = CPEBaja.CONTRA_FIRMA;
                    objPregunta.ruta_xml = ruta + nomARCHIVO + ".XML";
                    objPregunta.flg_firma = 0;
                    objRespuesta = objSignature.FirmaXMl(objPregunta);
                    dictionary = objENV.EnvioResumen(CPEBaja.NRO_DOCUMENTO_EMPRESA, CPEBaja.USUARIO_SOL_EMPRESA, CPEBaja.PASS_SOL_EMPRESA, nomARCHIVO, ruta, url, objRespuesta.DigestValue);
                    break;
                case 2:
                    ruta = "D:\\CPE\\HOMOLOGACION\\";
                    rutaFirma = "D:\\CPE\\FIRMA\\" + CPEBaja.RUTA_PFX;
                    url = "https://www.sunat.gob.pe/ol-ti-itcpgem-sqa/billService";
                    objXML.ResumenBaja(CPEBaja, nomARCHIVO, ruta);
                    objPregunta.ruta_Firma = rutaFirma;
                    objPregunta.contra_Firma = CPEBaja.CONTRA_FIRMA;
                    objPregunta.ruta_xml = ruta + nomARCHIVO + ".XML";
                    objPregunta.flg_firma = 0;
                    objRespuesta = objSignature.FirmaXMl(objPregunta);
                    dictionary = objENV.EnvioResumen(CPEBaja.NRO_DOCUMENTO_EMPRESA, CPEBaja.USUARIO_SOL_EMPRESA, CPEBaja.PASS_SOL_EMPRESA, nomARCHIVO, ruta, url, objRespuesta.DigestValue);
                    break;
                case 1:
                    ruta = "\\\\" + xconexion.ServidorIP + "\\ArchivoSistema\\CPE\\PRODUCCION\\";
                    rutaFirma = "D:\\CPE\\FIRMA\\" + CPEBaja.RUTA_PFX;
                    //url = "https://e-factura.sunat.gob.pe/ol-ti-itcpfegem/billService";
                    //url = "https://www.sunat.gob.pe/ol-ti-itcpfegem/billService";
                    url = "https://ose.nubefact.com/ol-ti-itcpe/billService?wsdl";
                    objXML.ResumenBaja(CPEBaja, nomARCHIVO, ruta);
                    objPregunta.ruta_Firma = rutaFirma;
                    objPregunta.contra_Firma = CPEBaja.CONTRA_FIRMA;
                    objPregunta.ruta_xml = ruta + nomARCHIVO + ".XML";
                    objPregunta.flg_firma = 0;
                    objRespuesta = objSignature.FirmaXMl(objPregunta);
                    dictionary = objENV.EnvioResumen(CPEBaja.NRO_DOCUMENTO_EMPRESA, CPEBaja.USUARIO_SOL_EMPRESA, CPEBaja.PASS_SOL_EMPRESA, nomARCHIVO, ruta, url, objRespuesta.DigestValue);
                    break;
            }
            return dictionary;
        }
        public Dictionary<string, string> ConsultaTicket(BE.CONSULTA_TICKET CPETicket)
        {
            Dictionary<string, string> dictionary = null;
            string nomARCHIVO = "";
            string ruta = "";
            string url = "";
            nomARCHIVO = CPETicket.NRO_DOCUMENTO_EMPRESA + "-" + CPETicket.TIPO_DOCUMENTO + "-" + CPETicket.NRO_DOCUMENTO;
            switch (CPETicket.TIPO_PROCESO)
            {
                case 3:
                    ruta = "\\\\" + xconexion.ServidorIP + "\\ArchivoSistema\\CPE\\BETA\\";
                    //url = "https://e-beta.sunat.gob.pe:443/ol-ti-itcpfegem-beta/billService";
                    url = "https://demo-ose.nubefact.com/ol-ti-itcpe/billService?wsdl";
                    dictionary = objENV.ConsultaTicket(CPETicket.NRO_DOCUMENTO_EMPRESA, CPETicket.USUARIO_SOL_EMPRESA, CPETicket.PASS_SOL_EMPRESA, nomARCHIVO, ruta, url, objRespuesta.DigestValue, CPETicket.TICKET);
                    break;
                case 2:
                    ruta = "\\\\" + xconexion.ServidorIP + "\\ArchivoSistema\\CPE\\HOMOLOGACION\\";
                    url = "https://www.sunat.gob.pe/ol-ti-itcpgem-sqa/billService";
                    dictionary = objENV.ConsultaTicket(CPETicket.NRO_DOCUMENTO_EMPRESA, CPETicket.USUARIO_SOL_EMPRESA, CPETicket.PASS_SOL_EMPRESA, nomARCHIVO, ruta, url, objRespuesta.DigestValue, CPETicket.TICKET);
                    break;
                case 1:
                    ruta = "\\\\" + xconexion.ServidorIP + "\\ArchivoSistema\\CPE\\PRODUCCION\\";
                    //url = "https://e-factura.sunat.gob.pe/ol-ti-itcpfegem/billService";
                    ////url = "https://www.sunat.gob.pe/ol-ti-itcpfegem/billService";
                    url = "https://ose.nubefact.com/ol-ti-itcpe/billService?wsdl";
                    dictionary = objENV.ConsultaTicket(CPETicket.NRO_DOCUMENTO_EMPRESA, CPETicket.USUARIO_SOL_EMPRESA, CPETicket.PASS_SOL_EMPRESA, nomARCHIVO, ruta, url, objRespuesta.DigestValue, CPETicket.TICKET);
                    break;
            }
            return dictionary;
        }
    }
}
