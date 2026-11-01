/**
 * Generates a styled, genuine Microsoft Excel SpreadsheetML (.xml / .xls) table.
 * When opened in Excel, Google Sheets, or Apple Numbers, it opens as a formatted table
 * with styled headers, alternating row colors, proper column widths, and real numeric cells.
 */

export function generateStyledExcelXml(
  quarters: string[],
  rows: Array<{
    company: string;
    values: Array<{ quarter: string; raw: string; num: number | null }>;
  }>,
  metric: string
): string {
  const sanitize = (text: string) =>
    (text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  // Calculate widths
  const colCount = quarters.length + 1;

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Title>Screener Financial Comparison - ${sanitize(metric)}</Title>
  <Author>Screener Financial Analyzer</Author>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#000000"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <!-- Header Style -->
  <Style ss:ID="HeaderStyle">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#1E3A8A"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#2563EB"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#2563EB"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#2563EB"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#1E40AF" ss:Pattern="Solid"/>
  </Style>
  <!-- Company Name Style -->
  <Style ss:ID="CompanyCol">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#0F172A" ss:Bold="1"/>
   <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
  </Style>
  <!-- Numeric Data Cell -->
  <Style ss:ID="DataCell">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#1E293B"/>
   <NumberFormat ss:Format="#,##0"/>
  </Style>
  <!-- Negative Data Cell -->
  <Style ss:ID="NegativeCell">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#DC2626" ss:Bold="1"/>
   <NumberFormat ss:Format="(#,##0)"/>
  </Style>
  <!-- Alternate Data Cell -->
  <Style ss:ID="DataCellAlt">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#1E293B"/>
   <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="#,##0"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Financial Comparison">
  <Table ss:ExpandedColumnCount="${colCount}" ss:DefaultRowHeight="22">
   <Column ss:AutoFitWidth="0" ss:Width="200"/>
`;

  // Column widths for quarters
  for (let i = 0; i < quarters.length; i++) {
    xml += `   <Column ss:AutoFitWidth="0" ss:Width="105"/>\n`;
  }

  // Header Row
  xml += `   <Row ss:Height="26">\n`;
  xml += `    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Company (${sanitize(metric)})</Data></Cell>\n`;
  for (const q of quarters) {
    xml += `    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">${sanitize(q)}</Data></Cell>\n`;
  }
  xml += `   </Row>\n`;

  // Data Rows
  rows.forEach((row, rIdx) => {
    const isAlt = rIdx % 2 === 1;
    xml += `   <Row ss:Height="22">\n`;
    xml += `    <Cell ss:StyleID="CompanyCol"><Data ss:Type="String">${sanitize(row.company)}</Data></Cell>\n`;

    row.values.forEach((v) => {
      if (v.num !== null && !isNaN(v.num)) {
        const style = v.num < 0 ? 'NegativeCell' : isAlt ? 'DataCellAlt' : 'DataCell';
        xml += `    <Cell ss:StyleID="${style}"><Data ss:Type="Number">${v.num}</Data></Cell>\n`;
      } else {
        xml += `    <Cell ss:StyleID="${isAlt ? 'DataCellAlt' : 'DataCell'}"><Data ss:Type="String">${sanitize(v.raw || '-')}</Data></Cell>\n`;
      }
    });

    xml += `   </Row>\n`;
  });

  xml += `  </Table>
 </Worksheet>
</Workbook>`;

  return xml;
}
