declare module "pdfkit-standalone" {
  import PDFDocument from "pdfkit";
  export default PDFDocument;
}

declare module "*.ttf?inline" {
  const dataUrl: string;
  export default dataUrl;
}
