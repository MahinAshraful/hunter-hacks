/**
 * One-time dev script: inspect the RA-89 PDF's AcroForm fields.
 * Run with:  npx tsx scripts/inspect-ra89-fields.ts
 */
import { PDFDocument } from 'pdf-lib';
import fs from 'node:fs';
import path from 'node:path';

async function main() {
const pdfPath = path.join(process.cwd(), 'public', 'ra-89-template.pdf');
const bytes = fs.readFileSync(pdfPath);
const pdfDoc = await PDFDocument.load(bytes);
const form = pdfDoc.getForm();
const fields = form.getFields();

if (fields.length === 0) {
  console.log('⚠️  No AcroForm fields found — PDF may be a scanned image or non-standard.');
  process.exit(0);
}

console.log(`✅ Found ${fields.length} AcroForm fields:\n`);
for (const field of fields) {
  const type = field.constructor.name;
  const name = field.getName();
  let extra = '';
  try {
    if (type === 'PDFTextField') {
      const tf = form.getTextField(name);
      const maxLen = tf.getMaxLength();
      extra = `maxLen=${maxLen ?? 'unlimited'}`;
    } else if (type === 'PDFCheckBox') {
      extra = 'checkbox';
    } else if (type === 'PDFDropdown') {
      extra = `options=${form.getDropdown(name).getOptions().join('|')}`;
    } else if (type === 'PDFRadioGroup') {
      extra = `options=${form.getRadioGroup(name).getOptions().join('|')}`;
    }
  } catch {
    extra = '(could not inspect)';
  }
  console.log(`  [${type.replace('PDF', '')}]  ${name}  ${extra}`);
}
}

main();
