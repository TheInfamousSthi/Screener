import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseFinancialNumber,
  formatFinancialValue,
  calculateQuarterSummary,
  sortQuartersChronologically,
  alignCompaniesQuarters,
  generateComparisonCsv,
} from './financial_utils';

test('parseFinancialNumber parses positive, negative, commas, and parentheses correctly', () => {
  assert.equal(parseFinancialNumber('13,934'), 13934);
  assert.equal(parseFinancialNumber('  -450.5  '), -450.5);
  assert.equal(parseFinancialNumber('(1,200)'), -1200);
  assert.equal(parseFinancialNumber('26%'), 26);
  assert.equal(parseFinancialNumber('-'), null);
  assert.equal(parseFinancialNumber(''), null);
  assert.equal(parseFinancialNumber('N/A'), null);
});

test('formatFinancialValue formats rupee amounts, negatives, and percentages', () => {
  assert.equal(formatFinancialValue(13934), '₹ 13,934 Cr');
  assert.equal(formatFinancialValue(-450), '-₹ 450 Cr');
  assert.equal(formatFinancialValue(24.56, true), '+24.6%');
  assert.equal(formatFinancialValue(-5.2, true), '-5.2%');
  assert.equal(formatFinancialValue(null), '-');
});

test('calculateQuarterSummary accurately computes QoQ and YoY deltas and growth %', () => {
  const quarters = ['Jun 2023', 'Sep 2023', 'Dec 2023', 'Mar 2024', 'Jun 2024'];
  const values = ['10,000', '10,500', '11,000', '11,500', '12,000'];

  const summary = calculateQuarterSummary(quarters, values);
  assert.equal(summary.latestQuarter, 'Jun 2024');
  assert.equal(summary.latestProfit, 12000);
  assert.equal(summary.prevQuarter, 'Mar 2024');
  assert.equal(summary.qoqChange, 500);
  assert.ok(Math.abs((summary.qoqChangePct || 0) - (500 / 11500) * 100) < 0.01);

  assert.equal(summary.yoyQuarter, 'Jun 2023');
  assert.equal(summary.yoyChange, 2000);
  assert.equal(summary.yoyChangePct, 20);
});

test('sortQuartersChronologically orders calendar quarters correctly', () => {
  const unsorted = ['Dec 2024', 'Mar 2023', 'Sep 2023', 'Jun 2024', 'Mar 2024'];
  const sorted = sortQuartersChronologically(unsorted);
  assert.deepEqual(sorted, ['Mar 2023', 'Sep 2023', 'Mar 2024', 'Jun 2024', 'Dec 2024']);
});

test('alignCompaniesQuarters generates side-by-side aligned matrix', () => {
  const companies = [
    {
      query: 'TCS',
      name: 'Tata Consultancy Services Ltd',
      url: '/company/TCS/',
      found: true,
      quarters: ['Mar 2024', 'Jun 2024', 'Sep 2024'],
      netProfit: ['12,434', '12,040', '11,909'],
      allRows: {
        'Net Profit': ['12,434', '12,040', '11,909'],
      },
    },
    {
      query: 'INFY',
      name: 'Infosys Ltd',
      url: '/company/INFY/',
      found: true,
      quarters: ['Jun 2024', 'Sep 2024', 'Dec 2024'],
      netProfit: ['6,368', '6,506', '6,588'],
      allRows: {
        'Net Profit': ['6,368', '6,506', '6,588'],
      },
    },
  ];

  const aligned = alignCompaniesQuarters(companies, 'Net Profit', 4);
  assert.deepEqual(aligned.quarters, ['Mar 2024', 'Jun 2024', 'Sep 2024', 'Dec 2024']);
  assert.equal(aligned.rows.length, 2);

  // TCS at Dec 2024 should be '-'
  assert.equal(aligned.rows[0].values[3].raw, '-');
  // INFY at Mar 2024 should be '-'
  assert.equal(aligned.rows[1].values[0].raw, '-');
  // INFY at Dec 2024 should be '6,588'
  assert.equal(aligned.rows[1].values[3].raw, '6,588');
});

test('generateComparisonCsv creates valid RFC 4180 CSV content', () => {
  const quarters = ['Jun 2024', 'Sep 2024'];
  const rows = [
    { company: 'TCS', values: [{ raw: '12,040' }, { raw: '11,909' }] },
    { company: 'Infosys', values: [{ raw: '6,368' }, { raw: '6,506' }] },
  ];

  const csv = generateComparisonCsv(quarters, rows, 'Net Profit');
  assert.ok(csv.includes('"Company (Net Profit)","Jun 2024","Sep 2024"'));
  assert.ok(csv.includes('"TCS","12,040","11,909"'));
});

test('getLast4QuartersData returns the most recent 4 quarters correctly', async () => {
  const { getLast4QuartersData } = await import('./financial_utils');
  const comp = {
    query: 'TCS',
    name: 'TCS',
    url: '',
    found: true,
    quarters: ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6'],
    netProfit: ['100', '200', '300', '400', '500', '600'],
    allRows: {},
  };
  const last4 = getLast4QuartersData(comp);
  assert.equal(last4.length, 4);
  assert.equal(last4[0].quarter, 'Q3');
  assert.equal(last4[3].quarter, 'Q6');
  assert.equal(last4[3].num, 600);
});

test('generateStyledExcelXml generates valid spreadsheet XML with styles and headers', async () => {
  const { generateStyledExcelXml } = await import('./excel_export');
  const xml = generateStyledExcelXml(
    ['Jun 2024', 'Sep 2024'],
    [{ company: 'TCS', values: [{ quarter: 'Jun 2024', raw: '12,000', num: 12000 }] }],
    'Net Profit'
  );
  assert.ok(xml.includes('<?xml version="1.0"'));
  assert.ok(xml.includes('urn:schemas-microsoft-com:office:spreadsheet'));
  assert.ok(xml.includes('HeaderStyle'));
  assert.ok(xml.includes('Company (Net Profit)'));
  assert.ok(xml.includes('TCS'));
});
