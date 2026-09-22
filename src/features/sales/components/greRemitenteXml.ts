import type { DeliveryGuideValues } from "./DeliveryGuidePdf";

type GreEmisor = {
  nombre?: string;
  ruc?: string;
};

const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const text = (value: string | undefined) => escapeXml(value?.trim() ?? "");

const documentType = (document: string) =>
  /^\d{11}$/.test(document.trim()) ? "6" : "1";

const timeWithSeconds = (value: string) =>
  /^\d{2}:\d{2}$/.test(value) ? `${value}:00` : value;

const fileSequence = (value: string) => String(Number(value));

export const greXmlFileName = (ruc: string, serie: string, number: string) =>
  `${ruc.trim()}-09-${serie.trim().toUpperCase()}-${fileSequence(number)}.xml`;

export const greZipFileName = (ruc: string, serie: string, number: string) =>
  greXmlFileName(ruc, serie, number).replace(/\.xml$/, ".zip");

export function crearXmlGreRemitente(values: DeliveryGuideValues, emisor: GreEmisor) {
  const ruc = emisor.ruc?.trim() ?? "";
  const razonSocial = emisor.nombre?.trim() ?? "";
  const serie = values.serie.trim().toUpperCase();
  const correlativo = values.number.trim().padStart(8, "0");
  const numeroGuia = `${serie}-${correlativo}`;
  const destinatarioTipoDocumento = documentType(values.recipientDocument);

  return `<?xml version="1.0" encoding="UTF-8"?>
<DespatchAdvice xmlns="urn:oasis:names:specification:ubl:schema:xsd:DespatchAdvice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
  <ext:UBLExtensions>
    <ext:UBLExtension><ext:ExtensionContent/></ext:UBLExtension>
  </ext:UBLExtensions>
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>1.0</cbc:CustomizationID>
  <cbc:ID>${text(numeroGuia)}</cbc:ID>
  <cbc:IssueDate>${text(values.deliveryDate)}</cbc:IssueDate>
  <cbc:IssueTime>${text(timeWithSeconds(values.emissionTime))}</cbc:IssueTime>
  <cbc:DespatchAdviceTypeCode>09</cbc:DespatchAdviceTypeCode>
  <cbc:Note>${text(values.reasonDescription)}</cbc:Note>
  <cac:Signature>
    <cbc:ID>${text(numeroGuia)}</cbc:ID>
    <cac:SignatoryParty>
      <cac:PartyIdentification><cbc:ID>${text(ruc)}</cbc:ID></cac:PartyIdentification>
      <cac:PartyName><cbc:Name>${text(razonSocial)}</cbc:Name></cac:PartyName>
    </cac:SignatoryParty>
    <cac:DigitalSignatureAttachment><cac:ExternalReference><cbc:URI>#SignSUNAT</cbc:URI></cac:ExternalReference></cac:DigitalSignatureAttachment>
  </cac:Signature>
  <cac:DespatchSupplierParty>
    <cbc:CustomerAssignedAccountID schemeID="6">${text(ruc)}</cbc:CustomerAssignedAccountID>
    <cac:Party><cac:PartyLegalEntity><cbc:RegistrationName>${text(razonSocial)}</cbc:RegistrationName></cac:PartyLegalEntity></cac:Party>
  </cac:DespatchSupplierParty>
  <cac:DeliveryCustomerParty>
    <cbc:CustomerAssignedAccountID schemeID="${destinatarioTipoDocumento}">${text(values.recipientDocument)}</cbc:CustomerAssignedAccountID>
    <cac:Party><cac:PartyLegalEntity><cbc:RegistrationName>${text(values.recipient)}</cbc:RegistrationName></cac:PartyLegalEntity></cac:Party>
  </cac:DeliveryCustomerParty>
  <cac:Shipment>
    <cbc:ID>1</cbc:ID>
    <cbc:HandlingCode>04</cbc:HandlingCode>
    <cbc:Information>${text(values.reasonDescription)}</cbc:Information>
    <cbc:GrossWeightMeasure unitCode="${text(values.weightUnit)}">${text(values.grossWeight)}</cbc:GrossWeightMeasure>
    <cac:ShipmentStage>
      <cbc:TransportModeCode>02</cbc:TransportModeCode>
      <cac:TransitPeriod><cbc:StartDate>${text(values.deliveryDate)}</cbc:StartDate></cac:TransitPeriod>
      <cac:TransportMeans><cac:RoadTransport><cbc:LicensePlateID>${text(values.vehiclePlate)}</cbc:LicensePlateID></cac:RoadTransport></cac:TransportMeans>
      <cac:DriverPerson><cbc:ID schemeID="1">${text(values.driverDocument)}</cbc:ID></cac:DriverPerson>
    </cac:ShipmentStage>
    <cac:Delivery><cac:DeliveryAddress>
      <cbc:ID>${text(values.arrivalUbigeo)}</cbc:ID>
      <cbc:StreetName>${text(values.arrival)}</cbc:StreetName>
    </cac:DeliveryAddress></cac:Delivery>
    <cac:OriginAddress>
      <cbc:ID>${text(values.departureUbigeo)}</cbc:ID>
      <cbc:StreetName>${text(values.departure)}</cbc:StreetName>
    </cac:OriginAddress>
  </cac:Shipment>
${values.items.map((item, index) => `  <cac:DespatchLine>
    <cbc:ID>${index + 1}</cbc:ID>
    <cbc:DeliveredQuantity unitCode="${text(item.unit)}">${text(item.quantity)}</cbc:DeliveredQuantity>
    <cac:OrderLineReference><cbc:LineID>${index + 1}</cbc:LineID></cac:OrderLineReference>
    <cac:Item>${item.code.trim() ? `<cac:SellersItemIdentification><cbc:ID>${text(item.code)}</cbc:ID></cac:SellersItemIdentification>` : ""}<cbc:Description>${text(item.description)}</cbc:Description></cac:Item>
  </cac:DespatchLine>`).join("\n")}
</DespatchAdvice>
`;
}
